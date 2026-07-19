import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import {
  getBookingGroupById,
  getBookingResourceById,
  updateBookingGroup,
  updateBookingResource,
  listBookingResources,
  toBookingGroupJson,
  toBookingResourceJson,
} from '@/lib/firestore/bookings'
import type { FirestoreBookingGroup, FirestoreBookingResource } from '@/lib/firestore/types'

// Sửa (tên/icon/màu/sức chứa/biển số/người duyệt) và tắt/bật (xóa mềm) một
// nhóm tài nguyên hoặc tài nguyên Booking. Không xoá cứng — nhất quán với
// booking-purposes, vì bookings cũ còn tham chiếu resourceId/groupId.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin().catch((e) => e as Error)
  if (session instanceof Error) return NextResponse.json({ error: session.message }, { status: 403 })

  const { id } = await params
  const body = await req.json()

  if (body.type === 'group') {
    const group = await getBookingGroupById(id)
    if (!group) return NextResponse.json({ error: 'Không tìm thấy nhóm tài nguyên' }, { status: 404 })

    const patch: Partial<FirestoreBookingGroup> = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.icon === 'string' && body.icon.trim()) patch.icon = body.icon.trim()
    if (typeof body.description === 'string') patch.description = body.description.trim() || null
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    await updateBookingGroup(id, patch)

    // Tắt nhóm kéo theo tắt toàn bộ tài nguyên con đang bật (bật lại nhóm
    // KHÔNG tự bật lại tài nguyên con — xem design.md Decision 2 & Risk 2).
    if (patch.isActive === false) {
      const resources = await listBookingResources(true)
      const children = resources.filter((r) => r.groupId === id && r.isActive)
      await Promise.all(children.map((r) => updateBookingResource(r.id, { isActive: false })))
    }

    const updated = await getBookingGroupById(id)
    return NextResponse.json(toBookingGroupJson(updated!))
  }

  if (body.type === 'resource') {
    const resource = await getBookingResourceById(id)
    if (!resource) return NextResponse.json({ error: 'Không tìm thấy tài nguyên' }, { status: 404 })

    const patch: Partial<FirestoreBookingResource> = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.color === 'string' && body.color.trim()) patch.color = body.color.trim()
    if (body.capacity !== undefined) patch.capacity = body.capacity ? Number(body.capacity) : null
    if (body.plate !== undefined) patch.plate = body.plate || null
    if (Array.isArray(body.approver_ids)) patch.approverIds = body.approver_ids
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    if (body.manager_id !== undefined) patch.managerId = body.manager_id || null
    if (Array.isArray(body.follower_ids)) patch.followerIds = body.follower_ids

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    await updateBookingResource(id, patch)
    const updated = await getBookingResourceById(id)
    return NextResponse.json(toBookingResourceJson(updated!))
  }

  return NextResponse.json({ error: "type phải là 'group' hoặc 'resource'" }, { status: 400 })
}
