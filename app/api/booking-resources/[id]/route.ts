import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { requireSession, isAdmin } from '@/lib/session'
import {
  getBookingGroupById,
  getBookingResourceById,
  updateBookingGroup,
  updateBookingResource,
  listBookingResources,
  toBookingGroupJson,
  toBookingResourceJson,
  parseBookingWindow,
  hasFutureBookingsForResource,
} from '@/lib/firestore/bookings'
import { createNotifications } from '@/lib/firestore/notifications'
import type { FirestoreBookingGroup, FirestoreBookingResource } from '@/lib/firestore/types'

// Field "vận hành" — "Quản lý tài nguyên" (managerId, không phải admin toàn
// cục) được phép tự sửa cho ĐÚNG tài nguyên mình quản lý (xem design.md
// Decision 3-4 của change booking-notifications-audit-permissions). Mọi field
// khác (loại đăng ký, giới hạn giờ, đổi nhóm/quản lý...) vẫn chỉ admin toàn
// cục mới sửa được.
const RESOURCE_MANAGER_ALLOWED_KEYS = new Set(['type', 'isActive', 'attachments', 'follower_ids'])

// Sửa (tên/icon/màu/sức chứa/biển số/người duyệt) và tắt/bật (xóa mềm) một
// nhóm tài nguyên hoặc tài nguyên Booking. Không xoá cứng — nhất quán với
// booking-purposes, vì bookings cũ còn tham chiếu resourceId/groupId.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  if (body.type === 'group') {
    if (!isAdmin(session)) return NextResponse.json({ error: 'Chỉ admin mới được sửa nhóm tài nguyên' }, { status: 403 })
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

    const isResourceManager = resource.managerId === session.uid
    if (!isAdmin(session) && !isResourceManager) {
      return NextResponse.json({ error: 'Không có quyền sửa tài nguyên này' }, { status: 403 })
    }
    if (!isAdmin(session)) {
      const hasPolicyField = Object.keys(body).some((k) => !RESOURCE_MANAGER_ALLOWED_KEYS.has(k))
      if (hasPolicyField) {
        return NextResponse.json({ error: 'Quản lý tài nguyên chỉ được sửa trạng thái mở/đóng, tệp đính kèm, người theo dõi' }, { status: 403 })
      }
    }

    const patch: Partial<Omit<FirestoreBookingResource, 'bookingWindow'>> & {
      bookingWindow?: FirestoreBookingResource['bookingWindow'] | FieldValue
    } = {}
    if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
    if (typeof body.color === 'string' && body.color.trim()) patch.color = body.color.trim()
    if (body.capacity !== undefined) patch.capacity = body.capacity ? Number(body.capacity) : null
    if (body.plate !== undefined) patch.plate = body.plate || null
    if (Array.isArray(body.approver_ids)) patch.approverIds = body.approver_ids
    if (typeof body.isActive === 'boolean') patch.isActive = body.isActive
    if (body.manager_id !== undefined) patch.managerId = body.manager_id || null
    if (Array.isArray(body.follower_ids)) patch.followerIds = body.follower_ids
    if (body.registration_type === 'auto' || body.registration_type === 'approval') {
      patch.registrationType = body.registration_type
    }
    if (Array.isArray(body.attachments)) patch.attachments = body.attachments
    // null tường minh = tắt giới hạn (xoá field hẳn), object = đặt giới hạn
    // mới, không có key này trong body = không đụng tới field hiện có.
    if (body.booking_window === null) patch.bookingWindow = FieldValue.delete()
    else if (body.booking_window !== undefined) patch.bookingWindow = parseBookingWindow(body.booking_window)

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Không có gì để cập nhật' }, { status: 400 })
    }

    await updateBookingResource(id, patch)

    // Đóng tài nguyên đang có booking tương lai -> báo quản lý + follower CỦA
    // TÀI NGUYÊN đó (xem design.md Decision 5 của change
    // booking-notifications-audit-permissions) — chỉ báo khi thực sự có ảnh
    // hưởng, tránh spam thông báo vô ích.
    if (patch.isActive === false && (await hasFutureBookingsForResource(id))) {
      const recipients = [resource.managerId, ...(resource.followerIds ?? [])].filter(
        (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
      )
      if (recipients.length > 0) {
        await createNotifications(recipients.map((userId) => ({
          userId,
          title: 'Tài nguyên đã đóng',
          body: `Tài nguyên "${resource.name}" vừa bị đóng, đang có đăng ký tương lai chưa diễn ra.`,
          link: `/bookings?group=${resource.groupId}`,
          type: 'booking_resource_closed',
        })))
      }
    }

    const updated = await getBookingResourceById(id)
    return NextResponse.json(toBookingResourceJson(updated!))
  }

  return NextResponse.json({ error: "type phải là 'group' hoặc 'resource'" }, { status: 400 })
}
