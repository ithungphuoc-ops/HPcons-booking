import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { MemberGroup } from "@/lib/firestore/types";

// ⚠️ Xem quy ước hạn mức Firestore đầy đủ ở lib/firestore/bookingPurposes.ts (sự cố
// RESOURCE_EXHAUSTED 13/09/2026). Cache 60s — AN TOÀN không cần revalidateTag ở phía Booking vì
// collection `memberGroups` do App Tổng (hpcons-portal) SỞ HỮU VÀ GHI, Booking chỉ ĐỌC — không
// có hàm ghi nào ở repo này, nên độ trễ 60s không gây bug như đã gặp ở ITAsset (nơi app tự ghi VÀ
// tự đọc cùng dữ liệu). Dùng chung 1 cache cho cả app/api/managers và app/api/member-groups,
// tránh 2 route tự đọc riêng cùng 1 collection.
export const layToanBoMemberGroupsDaCache = unstable_cache(
  async (): Promise<(MemberGroup & { id: string })[]> => {
    const snap = await adminDb.collection("memberGroups").get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as MemberGroup) }));
  },
  ["booking-member-groups"],
  { revalidate: 60 },
);
