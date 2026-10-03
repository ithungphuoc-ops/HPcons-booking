import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { listAllUsers, toUserJson } from '@/lib/firestore/users'
import { listAllDepartments } from '@/lib/firestore/departments'
import { resolveDirectManagerIdThuan } from '@/lib/quanLyTrucTiep'

// Bản chỉ-đọc (GET) của app/api/members/route.ts (hpcons-portal) — Booking
// chỉ cần danh sách nhân viên để chọn người theo dõi/quản lý/@mention, không
// cần quyền tạo/sửa nhân viên (ở lại app tổng). Xem plan tách Booking.
//
// Bắt đăng nhập (thêm 18/08/2026, code review phát hiện): route này trả cả
// email + SĐT toàn bộ nhân viên, trước đây KHÔNG kiểm tra phiên đăng nhập gì
// cả — ai biết đúng địa chỉ là xem được, dù chưa từng đăng nhập Booking.
export async function GET() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [users, departments] = await Promise.all([
    listAllUsers(),
    listAllDepartments(),
  ])
  const deptName = new Map<string, string>()
  const deptById = new Map(departments.map((d) => [d.id, d]))
  departments.forEach((d) => deptName.set(d.id, d.name))
  const nameByUid = new Map<string, string>()
  users.forEach((u) => nameByUid.set(u.id, u.fullName))

  // manager_name theo luật "Quản lý trực tiếp" chung (03/10/2026, lib/quanLyTrucTiep.ts):
  // directManagerIds → trưởng đơn vị chính → trưởng nhóm cha. Tra cứu hoàn toàn trong bộ nhớ
  // (users + departments đã cache), không thêm lượt đọc Firestore.
  const rows = await Promise.all(
    users.map(async (u) => {
      const managerId = await resolveDirectManagerIdThuan(
        u.id,
        u,
        (id) => nameByUid.has(id),
        (id) => deptById.get(id),
      )
      return {
        ...toUserJson(u),
        department: u.departmentId ? deptName.get(u.departmentId) ?? null : null,
        manager_name: managerId ? nameByUid.get(managerId) ?? null : null,
      }
    }),
  )
  return NextResponse.json(rows)
}
