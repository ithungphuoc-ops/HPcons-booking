import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { requireSession, isAdmin } from '@/lib/session'
import { layToanBoMemberGroupsDaCache } from '@/lib/firestore/memberGroupsCache'
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

  // Tránh chỉ mục kép (composite index): CHỈ lọc 1 điều kiện ở Firestore (nếu
  // có), rồi tự sắp xếp lại bằng JS sau khi lấy dữ liệu về — đúng quy ước đã
  // dùng ở app tổng (hpcons-portal) để không phải tạo/khai báo thêm chỉ mục
  // nào. `where('managerId', ...) + orderBy('createdAt', ...)` trước đây đòi
  // Firestore phải có chỉ mục kép (managerId + createdAt) chưa từng tạo, gây
  // lỗi "FAILED_PRECONDITION: The query requires an index." mỗi lần người
  // không phải Admin gọi route này.
  // Admin xem hết → dùng bản đã cache 60s (xem lib/firestore/memberGroupsCache.ts, cùng quy ước
  // hạn mức Firestore ghi ở lib/firestore/bookingPurposes.ts). Không phải admin → phạm vi đã hẹp
  // sẵn (đúng 1 người = quản lý của họ), đọc sống bình thường, không cần cache.
  let groups: (MemberGroup & { id: string })[]
  if (isAdmin(session)) {
    groups = await layToanBoMemberGroupsDaCache()
  } else {
    const snap = await adminDb.collection('memberGroups').where('managerId', '==', session.uid).get()
    groups = snap.docs.map((d) => ({ id: d.id, ...(d.data() as MemberGroup) }))
  }
  groups = [...groups].sort(
    // Optional chaining + fallback 0: tránh crash cả API nếu lỡ có doc cũ/lỗi
    // thiếu field createdAt — trước đây orderBy('createdAt') của Firestore tự
    // lặng lẽ bỏ qua doc thiếu field đó, còn sort JS này lấy về TOÀN BỘ doc
    // khớp where nên phải tự chống lỗi, đúng như bản gốc hpcons-portal đang làm.
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
  )
  return NextResponse.json({ groups })
}
