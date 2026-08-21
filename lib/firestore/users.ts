import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { unstable_cache } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreUser } from "./types";

const COLLECTION = "users";

export interface UserWithId extends FirestoreUser {
  id: string;
}

// Kết quả CACHE hoá của UserWithId — createdAt đổi từ Timestamp sang chuỗi
// ISO. Bắt buộc: unstable_cache lưu/lấy lại dữ liệu qua JSON, Timestamp đi
// qua vòng đó mất hết method .toDate() (bug thật gặp khi thêm cache tương
// tự ở HPCons-portal 21/08/2026, chặn kịp ở đây trước khi lặp lại).
export type CachedUserWithId = Omit<UserWithId, "createdAt"> & { createdAt: string | null };

// Cache 60 giây (thêm 21/08/2026, sau sự cố hết hạn mức Firestore project
// trung tâm — Booking dùng THẲNG project hpcons-portal làm project chính,
// không phải project riêng, nên góp phần vào đúng hạn mức bị hết): đọc
// TOÀN BỘ collection users mỗi lần gọi, không cache trước đây.
export const listAllUsers = unstable_cache(
  async (): Promise<CachedUserWithId[]> => {
    const snap = await adminDb.collection(COLLECTION).orderBy("fullName").get();
    return snap.docs.map((d) => {
      const data = d.data() as FirestoreUser;
      return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.().toISOString() ?? null };
    });
  },
  ["booking-list-all-users"],
  { revalidate: 60 },
);

export async function getUserById(id: string): Promise<UserWithId | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreUser) };
}

export async function createUserProfile(
  uid: string,
  data: {
    email: string;
    fullName: string;
    phone?: string | null;
    role: FirestoreUser["role"];
    departmentId?: string | null;
  },
): Promise<UserWithId> {
  const doc: FirestoreUser = {
    email: data.email,
    fullName: data.fullName,
    phone: data.phone ?? null,
    avatarUrl: null,
    role: data.role,
    departmentId: data.departmentId ?? null,
    isActive: true,
    createdAt: Timestamp.now(),
    title: null,
    address: null,
    managerId: null,
  };
  await adminDb.collection(COLLECTION).doc(uid).set(doc);
  return { id: uid, ...doc };
}

export async function updateUser(id: string, patch: Partial<FirestoreUser>): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).update(patch);
}

export function toUserJson(u: UserWithId | CachedUserWithId) {
  // createdAt có thể là Timestamp thật (vd getUserById) hoặc chuỗi ISO (đã
  // qua listAllUsers() cache) — nhận cả 2 dạng, không giả định chỉ 1 kiểu.
  // Fallback "" (không phải null): types/*.ts khai created_at: string (không
  // nullable) — thực tế mọi user thật đều có createdAt nên nhánh này gần
  // như không xảy ra.
  const createdAtIso = typeof u.createdAt === "string" ? u.createdAt : u.createdAt?.toDate?.().toISOString() ?? "";
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    username: u.username ?? null,
    phone: u.phone,
    avatar_url: u.avatarUrl,
    role: u.role,
    department_id: u.departmentId,
    is_active: u.isActive,
    created_at: createdAtIso,
    title: u.title,
    address: u.address,
    manager_id: u.managerId,
    employee_code: u.employeeCode ?? null,
    employment_status: u.employmentStatus ?? "active",
    status_note: u.statusNote ?? null,
    status_since: u.statusSince ?? null,
    expected_return: u.expectedReturn ?? null,
    transfer_to: u.transferTo ?? null,
    settings: u.settings ?? null,
  };
}

/** Lịch sử thay đổi trạng thái công tác của 1 nhân viên (mới nhất trước) */
export async function listStatusLogs(userId: string) {
  const snap = await adminDb
    .collection("statusLogs")
    .where("userId", "==", userId)
    .get();
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        from_status: x.fromStatus ?? null,
        to_status: x.toStatus ?? null,
        note: x.note ?? null,
        effective_date: x.effectiveDate ?? null,
        expected_return: x.expectedReturn ?? null,
        transfer_to: x.transferTo ?? null,
        changed_by: x.changedByEmail ?? null,
        created_at: x.createdAt?.toDate?.().toISOString() ?? null,
      };
    })
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
}
