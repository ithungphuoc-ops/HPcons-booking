import "server-only";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import { getUserById } from "./users";
import { resolveDirectManagerIdThuan } from "@/lib/quanLyTrucTiep";

export interface DepartmentWithId {
  id: string;
  name: string;
  leaderId: string | null;
  parentId: string | null;
  isHrDepartment: boolean;
}

/**
 * Toàn bộ phòng ban — cache 5 phút (thêm 21/08/2026, sau sự cố hết hạn mức
 * Firestore): trước đây 4 nơi (`/api/members`, `/api/units`, `/api/bookings`,
 * `/api/bookings/[id]`) đều tự đọc sống collection này mỗi lần gọi, dù danh
 * sách phòng ban gần như không đổi trong ngày — cache dài hơn user profile
 * (5 phút so với 30-60s) vì đây là dữ liệu tổ chức, thay đổi hiếm hơn nhiều.
 */
export const listAllDepartments = unstable_cache(
  async (): Promise<DepartmentWithId[]> => {
    const snap = await adminDb.collection("departments").get();
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: (data.name as string) ?? "",
        leaderId: (data.leaderId as string | undefined) ?? null,
        parentId: (data.parentId as string | undefined) ?? null,
        isHrDepartment: (data.isHrDepartment as boolean) ?? false,
      };
    });
  },
  ["booking-departments"],
  { revalidate: 300 },
);

/**
 * "Quản lý trực tiếp" của 1 nhân viên — theo hợp đồng dữ liệu chung
 * 03/10/2026 (luật nằm ở lib/quanLyTrucTiep.ts): directManagerIds (theo thứ
 * tự, bỏ chính mình/uid không tồn tại) → trưởng đơn vị chính → trưởng nhóm
 * cha (tối đa 10 bước) → null. Đọc SỐNG Firestore (không cache) như bản cũ —
 * kết quả quyết định người duyệt booking nên phải mới nhất. Trường hợp phổ
 * biến (không directManagerIds, đơn vị có trưởng) vẫn đúng 2 lượt đọc như cũ.
 */
export async function getDirectManagerId(
  userId: string,
  // Hồ sơ người dùng đã đọc sẵn (vd /api/managers) — tránh đọc users/{uid} 2 lần.
  preloadedUser?: Awaited<ReturnType<typeof getUserById>>,
): Promise<string | null> {
  const user = preloadedUser !== undefined ? preloadedUser : await getUserById(userId);
  return resolveDirectManagerIdThuan(
    userId,
    user,
    async (id) => (await adminDb.collection("users").doc(id).get()).exists,
    async (deptId) => {
      const snap = await adminDb.collection("departments").doc(deptId).get();
      if (!snap.exists) return null;
      const data = snap.data() ?? {};
      return {
        leaderId: (data.leaderId as string | undefined) ?? null,
        parentId: (data.parentId as string | undefined) ?? null,
      };
    },
  );
}

/**
 * "Quản lý nhân sự" = Trưởng đơn vị của phòng ban được đánh dấu
 * `isHrDepartment: true` (đặt qua trang Nhóm/Đơn vị, /dashboard/units).
 * Trả null nếu chưa có phòng ban nào được đánh dấu, hoặc phòng đó chưa có
 * trưởng đơn vị.
 */
export async function getHrDepartmentLeaderId(): Promise<string | null> {
  const snap = await adminDb.collection("departments").where("isHrDepartment", "==", true).limit(1).get();
  if (snap.empty) return null;
  const leaderId = snap.docs[0].data()?.leaderId as string | undefined;
  return leaderId ?? null;
}

/**
 * true nếu userId là "quản lý" của ít nhất 1 người — theo hợp đồng
 * 03/10/2026: là trưởng đơn vị (leaderId) của ≥1 phòng ban HOẶC có user nào
 * khai userId trong directManagerIds. Dùng để quyết định có hiện tab
 * "Chờ duyệt" ở Booking hay không.
 * Truy vấn `array-contains` trên 1 trường dùng index đơn trường Firestore tự
 * tạo — KHÔNG cần thêm composite index vào firestore.indexes.json.
 */
export async function isAnyDepartmentLeader(userId: string): Promise<boolean> {
  const [leaderSnap, directSnap] = await Promise.all([
    adminDb.collection("departments").where("leaderId", "==", userId).limit(1).get(),
    adminDb.collection("users").where("directManagerIds", "array-contains", userId).limit(1).get(),
  ]);
  return !leaderSnap.empty || !directSnap.empty;
}
