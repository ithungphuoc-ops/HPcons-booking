import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireSession } from '@/lib/session'
import type { MemberGroup } from '@/lib/firestore/types'

/**
 * Quản lý trực tiếp — nguồn dữ liệu là managerId của "Nhóm thành viên" (collection
 * memberGroups, cùng project với hpcons-portal), ĐỒNG BỘ với cách quatang/base-request-app đang
 * làm (30/07/2026) — KHÔNG dùng department.leaderId như /api/members đang tính "manager_name"
 * (đó là field khác, không liên quan tới field này).
 *
 * defaultManagerId: nhóm ĐẦU TIÊN (theo tên) mà chính người gọi có mặt trong memberIds VÀ đã gán
 * managerId — chỉ là gợi ý, người dùng vẫn tự đổi được ở UI (xem BookingFormDialog.tsx).
 * managerIds: mọi uid hiện đang là managerId của ≥1 nhóm — dùng cho danh sách gợi ý duyệt nhanh khi
 * chưa gõ tìm gì (tên/username resolve ở client từ prop `members` đã có sẵn, không cần trả ở đây).
 */
export async function GET() {
  let session
  try {
    session = await requireSession()
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 })
  }

  const snap = await adminDb.collection('memberGroups').get()
  const managerIds = new Set<string>()
  const candidates: { name: string; managerId: string }[] = []

  snap.forEach((doc) => {
    const data = doc.data() as MemberGroup
    if (!data.managerId) return
    managerIds.add(data.managerId)
    if (Array.isArray(data.memberIds) && data.memberIds.includes(session.uid)) {
      candidates.push({ name: data.name ?? '', managerId: data.managerId })
    }
  })

  candidates.sort((a, b) => a.name.localeCompare(b.name, 'vi'))
  const defaultManagerId = candidates[0]?.managerId ?? null

  return NextResponse.json({ defaultManagerId, managerIds: Array.from(managerIds) })
}
