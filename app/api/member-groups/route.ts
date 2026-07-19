import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireSession, isAdmin } from '@/lib/session'
import type { MemberGroup } from '@/lib/firestore/types'

// Bản chỉ-đọc (GET) của app/api/member-groups/route.ts (hpcons-portal) —
// Booking chỉ cần danh sách nhóm để gợi ý @mention, không quản trị nhóm
// (tạo/sửa ở lại app tổng). Xem plan tách Booking.
export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  let query = adminDb.collection('memberGroups').orderBy('createdAt', 'desc') as FirebaseFirestore.Query
  if (!isAdmin(session)) {
    query = query.where('managerId', '==', session.uid)
  }
  const snap = await query.get()
  const groups = snap.docs.map((d) => ({ id: d.id, ...(d.data() as MemberGroup) }))
  return NextResponse.json({ groups })
}
