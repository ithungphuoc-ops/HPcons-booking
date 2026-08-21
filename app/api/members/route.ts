import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { listAllUsers, toUserJson } from '@/lib/firestore/users'
import { listAllDepartments } from '@/lib/firestore/departments'

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
  const deptLeader = new Map<string, string | null>()
  departments.forEach((d) => {
    deptName.set(d.id, d.name)
    deptLeader.set(d.id, d.leaderId)
  })
  const nameByUid = new Map<string, string>()
  users.forEach((u) => nameByUid.set(u.id, u.fullName))

  return NextResponse.json(
    users.map((u) => {
      const leaderId = u.departmentId ? deptLeader.get(u.departmentId) : null
      const manager_name = leaderId && leaderId !== u.id ? nameByUid.get(leaderId) ?? null : null
      return {
        ...toUserJson(u),
        department: u.departmentId ? deptName.get(u.departmentId) ?? null : null,
        manager_name,
      }
    }),
  )
}
