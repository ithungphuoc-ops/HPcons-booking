import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { listAllUsers, toUserJson } from '@/lib/firestore/users'

// Bản chỉ-đọc (GET) của app/api/members/route.ts (hpcons-portal) — Booking
// chỉ cần danh sách nhân viên để chọn người theo dõi/quản lý/@mention, không
// cần quyền tạo/sửa nhân viên (ở lại app tổng). Xem plan tách Booking.
export async function GET() {
  const [users, deptSnap] = await Promise.all([
    listAllUsers(),
    adminDb.collection('departments').get(),
  ])
  const deptName = new Map<string, string>()
  const deptLeader = new Map<string, string | null>()
  deptSnap.forEach((d) => {
    deptName.set(d.id, (d.data().name as string) ?? '')
    deptLeader.set(d.id, (d.data().leaderId as string) ?? null)
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
