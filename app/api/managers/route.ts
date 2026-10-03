import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { layToanBoMemberGroupsDaCache } from '@/lib/firestore/memberGroupsCache'
import { getDirectManagerId } from '@/lib/firestore/departments'
import { getUserById } from '@/lib/firestore/users'
import { docDirectManagerIds } from '@/lib/quanLyTrucTiep'

/**
 * Gợi ý "Quản lý trực tiếp" cho form đặt lịch (BookingFormDialog.tsx).
 *
 * Từ 03/10/2026 (hợp đồng dữ liệu chung "Quản lý trực tiếp"):
 * - defaultManagerId = Quản lý trực tiếp đã resolve của NGƯỜI GỌI theo đúng luật server dùng
 *   khi tạo booking (getDirectManagerId: directManagerIds → trưởng đơn vị chính → trưởng nhóm
 *   cha). Trước đây lấy theo memberGroups.managerId — lệch với luật duyệt thật. Không resolve
 *   được → null (form để trống, người dùng tự chọn; server khi đó cũng không có cấp 1).
 * - directManagerIds = danh sách quản lý trực tiếp người gọi đã khai (theo thứ tự) — form đưa
 *   lên ĐẦU danh sách chọn tay.
 * - managerIds = nguồn cũ giữ nguyên: mọi uid đang là managerId của ≥1 "Nhóm thành viên"
 *   (memberGroups) — danh sách gợi ý duyệt nhanh khi chưa gõ tìm gì.
 * Người dùng vẫn đổi được sang bất kỳ ai (gửi lên dạng manager_override_id).
 */
export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const [groups, me] = await Promise.all([
    layToanBoMemberGroupsDaCache(),
    getUserById(session.uid),
  ])
  const defaultManagerId = await getDirectManagerId(session.uid, me)
  const directManagerIds = docDirectManagerIds(me?.directManagerIds).filter((id) => id !== session.uid)

  const managerIds = new Set<string>()
  groups.forEach((data) => {
    if (data.managerId) managerIds.add(data.managerId)
  })

  return NextResponse.json({
    defaultManagerId,
    directManagerIds,
    managerIds: [...directManagerIds, ...Array.from(managerIds).filter((id) => !directManagerIds.includes(id))],
  })
}
