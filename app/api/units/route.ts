import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { listAllUsers } from '@/lib/firestore/users'
import { requireSession } from '@/lib/session'

// Danh sách đơn vị (dùng lại collection departments) kèm thành viên + trưởng đơn vị
export async function GET() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [deptSnap, users] = await Promise.all([
    adminDb.collection('departments').orderBy('name').get(),
    listAllUsers(),
  ])

  const byDept = new Map<string, typeof users>()
  const unassigned: typeof users = []
  for (const u of users) {
    if (u.departmentId) {
      const arr = byDept.get(u.departmentId) ?? []
      arr.push(u)
      byDept.set(u.departmentId, arr)
    } else {
      unassigned.push(u)
    }
  }

  const member = (u: (typeof users)[number]) => ({
    id: u.id, full_name: u.fullName, title: u.title ?? null,
    role: u.role, employment_status: u.employmentStatus ?? 'active',
  })

  const units = deptSnap.docs.map((d) => {
    const data = d.data()
    const members = (byDept.get(d.id) ?? []).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
    const leader = data.leaderId ? users.find((u) => u.id === data.leaderId) : null
    return {
      id: d.id,
      name: (data.name as string) ?? '',
      leader_id: (data.leaderId as string) ?? null,
      leader_name: leader ? leader.fullName : null,
      is_hr_department: (data.isHrDepartment as boolean) ?? false,
      member_count: members.length,
      members: members.map(member),
    }
  })

  return NextResponse.json({
    units,
    unassigned: { member_count: unassigned.length, members: unassigned.map(member) },
  })
}
