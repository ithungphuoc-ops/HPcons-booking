import { NextResponse } from 'next/server'
import { requireSession, isAdmin } from '@/lib/session'
import { listAllUsers } from '@/lib/firestore/users'
import { listBookingPurposes } from '@/lib/firestore/bookingPurposes'
import {
  listBookingResources,
  getBookingById,
  decideBooking,
  cancelBooking,
  findApprovedConflict,
  toBookingJson,
} from '@/lib/firestore/bookings'

// Chi tiết 1 booking
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const booking = await getBookingById(id)
  if (!booking) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 })

  const [resources, users, purposes] = await Promise.all([
    listBookingResources(true),
    listAllUsers(),
    listBookingPurposes(true),
  ])
  const userMap = new Map(users.map((u) => [u.id, { full_name: u.fullName, email: u.email, title: u.title }]))
  const resourceMap = new Map(resources.map((r) => [r.id, { id: r.id, group_id: r.groupId, name: r.name, color: r.color, description: r.description, manager_id: r.managerId ?? null, follower_ids: r.followerIds ?? [] }]))
  const purposeMap = new Map(purposes.map((p) => [p.id, p.name]))

  return NextResponse.json(toBookingJson(booking, userMap, resourceMap, purposeMap))
}

// Duyệt / từ chối — theo cấp duyệt của tài nguyên, admin có thể ép duyệt hết
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const action = body.action as 'approve' | 'reject'
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'action phải là approve hoặc reject' }, { status: 400 })
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
