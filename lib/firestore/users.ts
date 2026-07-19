import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreUser } from "./types";

const COLLECTION = "users";

export interface UserWithId extends FirestoreUser {
  id: string;
}

export async function listAllUsers(): Promise<UserWithId[]> {
  const snap = await adminDb.collection(COLLECTION).orderBy("fullName").get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreUser) }));
}

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

export function toUserJson(u: UserWithId) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.fullName,
    phone: u.phone,
    avatar_url: u.avatarUrl,
    role: u.role,
    department_id: u.departmentId,
    is_active: u.isActive,
    created_at: u.createdAt?.toDate?.().toISOString() ?? null,
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
