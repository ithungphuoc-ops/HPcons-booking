import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { getUserById } from "./users";

/**
 * "Quản lý trực tiếp" của 1 nhân viên = Trưởng đơn vị (leaderId) của phòng ban
 * họ thuộc về. Trả null nếu không thuộc phòng ban nào, phòng ban chưa gán
 * trưởng, hoặc chính họ đã là trưởng đơn vị của mình (không có ai ở trên).
 * Dùng chung cho trang Tài khoản (app/api/profile/route.ts) và Booking
 * (lib/firestore/bookings.ts).
 */
export async function getDirectManagerId(userId: string): Promise<string | null> {
  const user = await getUserById(userId);
  if (!user?.departmentId) return null;

  const dept = await adminDb.collection("departments").doc(user.departmentId).get();
  if (!dept.exists) return null;

  const leaderId = dept.data()?.leaderId as string | undefined;
  if (!leaderId || leaderId === userId) return null;
  return leaderId;
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
 * true nếu userId là trưởng đơn vị của ÍT NHẤT 1 phòng ban (quản lý trực
 * tiếp của ai đó) hoặc là quản lý nhân sự. Dùng để quyết định có hiện tab
 * "Chờ duyệt" ở Booking hay không (thay cho check `resource.approverIds`
 * cũ — không còn dùng để xác định người duyệt, xem lib/firestore/bookings.ts).
 */
export async function isAnyDepartmentLeader(userId: string): Promise<boolean> {
  const snap = await adminDb.collection("departments").where("leaderId", "==", userId).limit(1).get();
  return !snap.empty;
}
