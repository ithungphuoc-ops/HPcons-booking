import { NextResponse } from 'next/server'
import { listAllUsers } from '@/lib/firestore/users'
import { listAllDepartments } from '@/lib/firestore/departments'
import { requireSession } from '@/lib/session'

// Danh sách đơn vị (dùng lại collection departments) kèm thành viên + trưởng đơn vị
export async function GET() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [departments, users] = await Promise.all([
    listAllDepartments(),
    listAllUsers(),
  ])
  const sortedDepartments = [...departments].sort((a, b) => a.name.localeCompare(b.name, 'vi'))

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

  const units = sortedDepartments.map((d) => {
    const members = (byDept.get(d.id) ?? []).sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi'))
    const leader = d.leaderId ? users.find((u) => u.id === d.leaderId) : null
    return {
      id: d.id,
      name: d.name,
      leader_id: d.leaderId,
      leader_name: leader ? leader.fullName : null,
      is_hr_department: d.isHrDepartment,
      member_count: members.length,
      members: members.map(member),
    }
  })

  return NextResponse.json({
    units,
    unassigned: { member_count: unassigned.length, members: unassigned.map(member) },
  })
}
