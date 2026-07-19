import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import { requireSession, isAdmin } from '@/lib/session'
import { listAllUsers } from '@/lib/firestore/users'
import { listBookingPurposes } from '@/lib/firestore/bookingPurposes'
import {
  listBookingResources,
  listBookingsSince,
  listBookingsInRange,
  createBooking,
  getBookingResourceById,
  toBookingJson,
  BookingConflictError,
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

  // Lịch tháng (app/(booking)/bookings/page.tsx) truyền from/to = khoảng ngày
  // đang hiển thị. Không truyền gì (vd trang Báo cáo) -> giữ mặc định 30 ngày cũ.
  const bookingsPromise = from && to
    ? listBookingsInRange(Timestamp.fromDate(new Date(from)), Timestamp.fromDate(new Date(to)))
    : listBookingsSince(Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))

  const [resources, bookings, users, purposes] = await Promise.all([
    listBookingResources(),
    bookingsPromise,
    listAllUsers(),
    listBookingPurposes(true),
  ])

  const userMap = new Map(users.map((u) => [u.id, { full_name: u.fullName, email: u.email, title: u.title }]))
  const resourceMap = new Map(resources.map((r) => [r.id, { id: r.id, group_id: r.groupId, name: r.name, color: r.color, description: r.description, manager_id: r.managerId ?? null, follower_ids: r.followerIds ?? [] }]))
  const purposeMap = new Map(purposes.map((p) => [p.id, p.name]))

  let rows = bookings

  if (scope === 'mine') rows = rows.filter((b) => b.userId === session.uid)
  else if (scope === 'following') rows = rows.filter((b) => b.followerIds.includes(session.uid))
  else if (scope === 'sent_to_me')
    rows = rows.filter((b) => b.approvals.some((a) => a.approverId === session.uid && a.status === 'pending'))

  if (resourceId) rows = rows.filter((b) => b.resourceId === resourceId)
  if (status) rows = rows.filter((b) => b.status === status)

  // Có thể là người duyệt (trưởng đơn vị bất kỳ hoặc quản lý nhân sự) để hiện tab "Chờ duyệt", hoặc là admin
  const canApproveSomething = isAdmin(session) || (await isAnyDepartmentLeader(session.uid))

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

  try {
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
    }, { managerOverrideId: body.manager_override_id || null })

    return NextResponse.json({ ok: true, id: booking.id })
  } catch (e) {
    if (e instanceof BookingConflictError) {
      return NextResponse.json({ error: e.message }, { status: 409 })
    }
    throw e
  }
}
