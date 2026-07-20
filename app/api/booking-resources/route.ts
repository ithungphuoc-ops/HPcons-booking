import { NextResponse } from 'next/server'
import { requireSession, requireAdmin } from '@/lib/session'
import {
  listBookingGroups,
  listBookingResources,
  createBookingGroup,
  createBookingResource,
  toBookingGroupJson,
  toBookingResourceJson,
  parseBookingWindow,
} from '@/lib/firestore/bookings'

// Danh sách nhóm + tài nguyên lồng nhau (mọi người xem được để đặt lịch —
// mặc định chỉ trả mục đang bật). `?includeInactive=1` dùng cho panel "Quản
// lý tài nguyên" để còn thấy mục đã tắt và bật lại được — cho phép MỌI
// session đăng nhập (không chỉ admin, 20/07/2026) vì "Quản lý tài nguyên"
// (managerId, không phải admin toàn cục) cũng cần thấy tài nguyên mình quản
// lý dù đang đóng để mở lại; dữ liệu tài nguyên đã tắt không nhạy cảm, quyền
// SỬA vẫn được kiểm tra riêng ở route PATCH. Người đặt lịch bình thường
// (không gọi kèm tham số này) luôn chỉ thấy mục đang bật.
export async function GET(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wantsInactive = new URL(req.url).searchParams.get('includeInactive') === '1'
  const [groups, resources] = await Promise.all([listBookingGroups(wantsInactive), listBookingResources(wantsInactive)])
  const result = groups.map((g) => ({
    ...toBookingGroupJson(g),
    resources: resources.filter((r) => r.groupId === g.id).map(toBookingResourceJson),
  }))
  return NextResponse.json(result)
}

// Admin: tạo nhóm mới ({ type: 'group', name, icon, description }) hoặc
// tài nguyên mới ({ type: 'resource', group_id, name, color, capacity, plate, approver_ids })
export async function POST(req: Request) {
  const session = await requireAdmin().catch((e) => e as Error)
  if (session instanceof Error) return NextResponse.json({ error: session.message }, { status: 403 })

  const body = await req.json()
  if (body.type === 'group') {
    if (!body.name?.trim()) return NextResponse.json({ error: 'Tên nhóm không được để trống' }, { status: 400 })
    const groups = await listBookingGroups(true)
    const group = await createBookingGroup({
      name: body.name.trim(),
      icon: body.icon || 'Package',
      description: body.description || null,
      sortOrder: groups.length,
    })
    return NextResponse.json(toBookingGroupJson(group))
  }

  if (body.type === 'resource') {
    if (!body.group_id || !body.name?.trim()) return NextResponse.json({ error: 'Thiếu nhóm hoặc tên tài nguyên' }, { status: 400 })
    const resources = await listBookingResources(true)
    const resource = await createBookingResource({
      groupId: body.group_id,
      name: body.name.trim(),
      description: body.description || null,
      color: body.color || '#096AA7',
      capacity: body.capacity ? Number(body.capacity) : null,
      plate: body.plate || null,
      approverIds: Array.isArray(body.approver_ids) ? body.approver_ids : [],
      sortOrder: resources.length,
      managerId: body.manager_id || null,
      followerIds: Array.isArray(body.follower_ids) ? body.follower_ids : [],
      registrationType: body.registration_type === 'auto' ? 'auto' : 'approval',
      bookingWindow: parseBookingWindow(body.booking_window),
    })
    return NextResponse.json(toBookingResourceJson(resource))
  }

  return NextResponse.json({ error: 'type phải là group hoặc resource' }, { status: 400 })
}
