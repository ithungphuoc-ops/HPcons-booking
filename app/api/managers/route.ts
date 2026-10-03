import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { getDirectManagerId, listAllDepartments } from '@/lib/firestore/departments'
import { getUserById } from '@/lib/firestore/users'
import { docDirectManagerIds } from '@/lib/quanLyTrucTiep'
import { danhSachTruongDonVi } from '@/lib/nhomPhongBan'

/**
 * Gợi ý "Quản lý trực tiếp" cho form đặt lịch (BookingFormDialog.tsx).
 *
 * Từ 03/10/2026 (hợp đồng dữ liệu chung "Quản lý trực tiếp"):
 * - defaultManagerId = Quản lý trực tiếp đã resolve của NGƯỜI GỌI theo đúng luật server dùng
 *   khi tạo booking (getDirectManagerId: directManagerIds → trưởng đơn vị chính → trưởng nhóm
 *   cha). Không resolve được → null (form để trống, người dùng tự chọn; server khi đó cũng không
 *   có cấp 1).
 * - directManagerIds = danh sách quản lý trực tiếp người gọi đã khai (theo thứ tự) — form đưa
 *   lên ĐẦU danh sách chọn tay.
 * - managerIds = directManagerIds rồi tới mọi TRƯỞNG ĐƠN VỊ (departments.leaderId, không trùng) —
 *   danh sách gợi ý duyệt nhanh khi chưa gõ tìm gì. Trước 03/10/2026 lấy theo
 *   memberGroups.managerId; "Nhóm thành viên" đã bị bỏ hẳn. Uid không còn tồn tại do form tự lọc
 *   (chỉ hiện người có trong /api/members).
 * Người dùng vẫn đổi được sang bất kỳ ai (gửi lên dạng manager_override_id).
 */
export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const [departments, me] = await Promise.all([
    listAllDepartments(),
    getUserById(session.uid),
  ])
  const defaultManagerId = await getDirectManagerId(session.uid, me)
  const directManagerIds = docDirectManagerIds(me?.directManagerIds).filter((id) => id !== session.uid)
  const leaderIds = danhSachTruongDonVi(departments)

  return NextResponse.json({
    defaultManagerId,
    directManagerIds,
    managerIds: [...directManagerIds, ...leaderIds.filter((id) => !directManagerIds.includes(id))],
  })
}
