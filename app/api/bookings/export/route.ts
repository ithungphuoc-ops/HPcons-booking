import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import * as XLSX from 'xlsx'
import { requireSession } from '@/lib/session'
import { listAllUsers } from '@/lib/firestore/users'
import { listBookingPurposes } from '@/lib/firestore/bookingPurposes'
import { listBookingGroups, listBookingResources, listBookingsSince, listBookingsInRange } from '@/lib/firestore/bookings'

const STATUS_LABELS: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy' }

// Xuất Excel đúng tập dữ liệu đang lọc trên trang Báo cáo (20/07/2026) — xử
// lý HOÀN TOÀN server-side (build workbook bằng `xlsx`), KHÔNG đưa `xlsx`
// vào bundle client (xem design.md Decision 2 của change
// booking-reports-export-polish — giữ đúng nguyên tắc "nhẹ app" từ Đợt 3).
// `user_ids` (nếu có) là danh sách đã lọc theo phòng ban ở CLIENT (xem
// Decision 3) — route này không tự tính lại phòng ban.
export async function GET(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const groupId = searchParams.get('group_id')
  const resourceId = searchParams.get('resource_id')
  const status = searchParams.get('status')
  const userId = searchParams.get('user_id')
  const userIdsParam = searchParams.get('user_ids') // "id1,id2,..." — đã lọc theo phòng ban ở client

  const bookingsPromise = from && to
    ? listBookingsInRange(Timestamp.fromDate(new Date(from)), Timestamp.fromDate(new Date(to)))
    : listBookingsSince(Timestamp.fromDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))

  const [groups, resources, bookings, users, purposes] = await Promise.all([
    listBookingGroups(),
    listBookingResources(),
    bookingsPromise,
    listAllUsers(),
    listBookingPurposes(true),
  ])

  const resourceMap = new Map(resources.map((r) => [r.id, r]))
  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]))
  const userMap = new Map(users.map((u) => [u.id, u.fullName]))
  const purposeMap = new Map(purposes.map((p) => [p.id, p.name]))

  let rows = bookings
  if (resourceId) rows = rows.filter((b) => b.resourceId === resourceId)
  else if (groupId) rows = rows.filter((b) => resourceMap.get(b.resourceId)?.groupId === groupId)
  if (status) rows = rows.filter((b) => b.status === status)
  if (userId) rows = rows.filter((b) => b.userId === userId)
  if (userIdsParam) {
    const allowed = new Set(userIdsParam.split(',').filter(Boolean))
    rows = rows.filter((b) => allowed.has(b.userId))
  }

  const sheetRows = rows.map((b) => {
    const resource = resourceMap.get(b.resourceId)
    return {
      'Tài nguyên': resource?.name ?? '',
      'Nhóm': resource ? groupNameMap.get(resource.groupId) ?? '' : '',
      'Tiêu đề': b.title,
      'Người đặt': userMap.get(b.userId) ?? '',
      'Mục đích': b.purposeText ?? (b.purposeId ? purposeMap.get(b.purposeId) ?? '' : ''),
      'Bắt đầu': b.startAt.toDate().toLocaleString('vi-VN'),
      'Kết thúc': b.endAt.toDate().toLocaleString('vi-VN'),
      'Trạng thái': STATUS_LABELS[b.status] ?? b.status,
    }
  })

  const sheet = XLSX.utils.json_to_sheet(sheetRows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Booking')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="booking-export-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
