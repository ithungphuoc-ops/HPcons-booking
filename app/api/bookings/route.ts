import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireSession, isAdmin } from '@/lib/session'
import { adminDb } from '@/lib/firebase/admin'
import { listAllUsers } from '@/lib/firestore/users'
import { listBookingPurposes, buildValidatedFormData, BookingFormValidationError } from '@/lib/firestore/bookingPurposes'
import {
  listBookingResources,
  listBookingsSince,
  listBookingsInRange,
  createBooking,
  getBookingResourceById,
  toBookingJson,
  BookingConflictError,
  BookingWindowError,
} from '@/lib/firestore/bookings'
import { isAnyDepartmentLeader } from '@/lib/firestore/departments'

export async function GET(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const scope = searchParams.get('scope') // 'mine' | 'following' | 'sent_to_me' | null (tất cả)
  const resourceId = searchParams.get('resource_id')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const userId = searchParams.get('user_id')

  // Lịch tháng (app/(booking)/bookings/page.tsx) truyền from/to = khoảng ngày
  // đang hiển thị. Không truyền gì (vd trang Báo cáo) -> giữ mặc định 30 ngày cũ.
  const bookingsPromise = from && to
    ? listBookingsInRange(Timestamp.fromDate(new Date(from)), Timestamp.fromDate(new Date(to)))
    : listBookingsSince(Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))

  // isAnyDepartmentLeader gộp vào CÙNG Promise.all (trước đây await riêng SAU khối này — 1 vòng
  // round-trip Firestore tuần tự không cần thiết, xem điều tra "F5 chậm" 30/07/2026).
  const [resources, bookings, users, purposes, deptSnap, canApproveSomething] = await Promise.all([
    listBookingResources(),
    bookingsPromise,
    listAllUsers(),
    listBookingPurposes(true),
    adminDb.collection('departments').get(),
    isAdmin(session) ? Promise.resolve(true) : isAnyDepartmentLeader(session.uid),
  ])

  // Tên phòng ban của người đặt (20/07/2026) — để hiển thị trên lịch, tránh
  // 2 phòng ban đặt trùng giờ mà không biết ai đã giữ chỗ trước. Cùng cách
  // làm với /api/members (join qua departmentId, không thêm collection mới).
  const deptName = new Map<string, string>()
  deptSnap.forEach((d) => deptName.set(d.id, (d.data().name as string) ?? ''))
  const userMap = new Map(users.map((u) => [
    u.id,
    { full_name: u.fullName, email: u.email, title: u.title, department: u.departmentId ? deptName.get(u.departmentId) ?? null : null },
  ]))
  const resourceMap = new Map(resources.map((r) => [r.id, { id: r.id, group_id: r.groupId, name: r.name, color: r.color, description: r.description, manager_id: r.managerId ?? null, follower_ids: r.followerIds ?? [] }]))
  const purposeMap = new Map(purposes.map((p) => [p.id, p.name]))

  let rows = bookings

  if (scope === 'mine') rows = rows.filter((b) => b.userId === session.uid)
  else if (scope === 'following') rows = rows.filter((b) => b.followerIds.includes(session.uid))
  else if (scope === 'sent_to_me')
    rows = rows.filter((b) => b.approvals.some((a) => a.approverId === session.uid && a.status === 'pending'))

  if (resourceId) rows = rows.filter((b) => b.resourceId === resourceId)
  if (status) rows = rows.filter((b) => b.status === status)
  if (userId) rows = rows.filter((b) => b.userId === userId)

  return NextResponse.json({
    bookings: rows.map((b) => toBookingJson(b, userMap, resourceMap, purposeMap)),
    isApprover: canApproveSomething,
    isAdmin: isAdmin(session),
    myUserId: session.uid,
  })
}

export async function POST(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.resource_id || !body.start_at || !body.end_at || !body.title?.trim()) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
  }
  const resource = await getBookingResourceById(body.resource_id)
  if (!resource || !resource.isActive) return NextResponse.json({ error: 'Tài nguyên không hợp lệ' }, { status: 400 })

  const startAt = Timestamp.fromDate(new Date(body.start_at))
  const endAt = Timestamp.fromDate(new Date(body.end_at))
  if (endAt.toMillis() <= startAt.toMillis()) {
    return NextResponse.json({ error: 'Giờ kết thúc phải sau giờ bắt đầu' }, { status: 400 })
  }

  const rawFormData: { fieldId?: string; label?: string; type?: string; value?: unknown }[] =
    Array.isArray(body.form_data) ? body.form_data : []

  try {
    const formData = await buildValidatedFormData(body.purpose_id, rawFormData)
    const booking = await createBooking({
      resourceId: body.resource_id,
      userId: session.uid,
      title: body.title.trim(),
      purposeId: body.purpose_id ?? null,
      purposeText: body.purpose_text ? String(body.purpose_text).trim() || null : null,
      note: body.note ?? null,
      destination: body.destination ?? null,
      passengers: body.passengers ?? null,
      quantity: body.quantity ? Number(body.quantity) : null,
      startAt,
      endAt,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      formData,
    }, {
      managerOverrideId: body.manager_override_id || null,
      registrationType: resource.registrationType,
      bookingWindow: resource.bookingWindow,
    })

    return NextResponse.json({ ok: true, id: booking.id })
  } catch (e) {
    if (e instanceof BookingConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    if (e instanceof BookingWindowError || e instanceof BookingFormValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    throw e
  }
}
