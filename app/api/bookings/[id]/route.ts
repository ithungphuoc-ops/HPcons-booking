import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireSession, isAdmin } from '@/lib/session'
import { listAllUsers } from '@/lib/firestore/users'
import { listAllDepartments } from '@/lib/firestore/departments'
import { listBookingPurposes, buildValidatedFormData, BookingFormValidationError } from '@/lib/firestore/bookingPurposes'
import {
  listBookingResources,
  getBookingById,
  getBookingResourceById,
  decideBooking,
  cancelBooking,
  findApprovedConflict,
  toBookingJson,
  updateBookingCore,
  BookingConflictError,
  BookingWindowError,
} from '@/lib/firestore/bookings'

// Chi tiết 1 booking
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  const [resources, users, purposes, departments] = await Promise.all([
    listBookingResources(true),
    listAllUsers(),
    listBookingPurposes(true),
    listAllDepartments(),
  ])
  const deptName = new Map<string, string>()
  departments.forEach((d) => deptName.set(d.id, d.name))
  const userMap = new Map(users.map((u) => [
    u.id,
    { full_name: u.fullName, email: u.email, title: u.title, department: u.departmentId ? deptName.get(u.departmentId) ?? null : null },
  ]))
  const resourceMap = new Map(resources.map((r) => [r.id, { id: r.id, group_id: r.groupId, name: r.name, color: r.color, description: r.description, manager_id: r.managerId ?? null, follower_ids: r.followerIds ?? [] }]))
  const purposeMap = new Map(purposes.map((p) => [p.id, p.name]))

  return NextResponse.json(toBookingJson(booking, userMap, resourceMap, purposeMap))
}

// Duyệt / từ chối / sửa — theo cấp duyệt của tài nguyên (admin có thể ép
// duyệt hết), hoặc sửa đăng ký (chủ booking chưa diễn ra, hoặc admin).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const action = body.action as 'approve' | 'reject' | 'edit'
  if (action !== 'approve' && action !== 'reject' && action !== 'edit') {
    return NextResponse.json({ error: 'action phải là approve, reject hoặc edit' }, { status: 400 })
  }

  if (action === 'edit') {
    const booking = await getBookingById(id)
    if (!booking) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    if (booking.userId !== session.uid && !isAdmin(session)) {
      return NextResponse.json({ error: 'Không có quyền sửa booking này' }, { status: 403 })
    }
    if (booking.startAt.toMillis() <= Date.now()) {
      return NextResponse.json({ error: 'Chỉ sửa được lịch chưa diễn ra' }, { status: 409 })
    }

    let resourceId: string | undefined
    if (body.resource_id && body.resource_id !== booking.resourceId) {
      const resource = await getBookingResourceById(body.resource_id)
      if (!resource || !resource.isActive) return NextResponse.json({ error: 'Tài nguyên không hợp lệ' }, { status: 400 })
      resourceId = body.resource_id
    }

    const startAt = body.start_at ? Timestamp.fromDate(new Date(body.start_at)) : undefined
    const endAt = body.end_at ? Timestamp.fromDate(new Date(body.end_at)) : undefined
    if (startAt && endAt && endAt.toMillis() <= startAt.toMillis()) {
      return NextResponse.json({ error: 'Giờ kết thúc phải sau giờ bắt đầu' }, { status: 400 })
    }

    const rawFormData: { fieldId?: string; label?: string; type?: string; value?: unknown }[] =
      Array.isArray(body.form_data) ? body.form_data : []

    try {
      const purposeId = body.purpose_id !== undefined ? (body.purpose_id ?? null) : undefined
      const formData = purposeId !== undefined ? await buildValidatedFormData(purposeId, rawFormData) : undefined

      await updateBookingCore(id, {
        title: body.title ? String(body.title).trim() : undefined,
        resourceId,
        startAt,
        endAt,
        purposeId,
        purposeText: body.purpose_text !== undefined ? (body.purpose_text ? String(body.purpose_text).trim() || null : null) : undefined,
        formData,
        note: body.note !== undefined ? (body.note || null) : undefined,
        destination: body.destination !== undefined ? (body.destination || null) : undefined,
        passengers: body.passengers !== undefined ? (body.passengers || null) : undefined,
        quantity: body.quantity !== undefined ? (body.quantity ? Number(body.quantity) : null) : undefined,
      }, session.uid)

      return NextResponse.json({ ok: true })
    } catch (e) {
      if (e instanceof BookingConflictError) return NextResponse.json({ error: e.message }, { status: 409 })
      if (e instanceof BookingWindowError || e instanceof BookingFormValidationError) {
        return NextResponse.json({ error: e.message }, { status: 400 })
      }
      throw e
    }
  }

  if (action === 'approve') {
    const booking = await getBookingById(id)
    if (!booking) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
    const conflict = await findApprovedConflict(booking.resourceId, booking.startAt, booking.endAt, id)
    if (conflict) {
      const users = await listAllUsers()
      const userMap = new Map(users.map((u) => [u.id, u.fullName]))
      const t = (ts: typeof booking.startAt) => ts.toDate().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      return NextResponse.json({
        error: `Trùng lịch với "${conflict.title}" của ${userMap.get(conflict.userId) ?? '—'} (${t(conflict.startAt)} → ${t(conflict.endAt)}). Từ chối đơn này hoặc hủy lịch kia trước.`,
      }, { status: 409 })
    }
  }

  const result = await decideBooking(id, session.uid, action, body.note ?? null, isAdmin(session))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 })
  return NextResponse.json({ ok: true })
}

// Hủy booking của chính mình (chỉ khi còn ở tương lai)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bk = await getBookingById(id)
  if (!bk) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })
  if (bk.userId !== session.uid && !isAdmin(session)) {
    return NextResponse.json({ error: 'Không có quyền hủy booking này' }, { status: 403 })
  }
  if (bk.startAt.toMillis() <= Date.now()) {
    return NextResponse.json({ error: 'Chỉ hủy được lịch chưa diễn ra' }, { status: 409 })
  }

  await cancelBooking(id, session.uid)
  return NextResponse.json({ ok: true })
}
