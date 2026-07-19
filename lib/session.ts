import "server-only";
import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { FirestoreUser, Role } from "@/lib/firestore/types";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS };

export interface Session {
  uid: string;
  email: string;
  // null nếu tài khoản Firebase Auth chưa có document users/{uid} tương ứng
  // (chưa được HR/IT cấp quyền — xem app/api/auth/session/route.ts)
  profile: (FirestoreUser & { id: string }) | null;
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    const snap = await adminDb.collection("users").doc(decoded.uid).get();
    const profile = snap.exists ? ({ id: snap.id, ...snap.data() } as FirestoreUser & { id: string }) : null;
    return { uid: decoded.uid, email: decoded.email ?? "", profile };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error("Chưa đăng nhập");
  return session;
}

const APPROVER_ROLES: Role[] = ["owner", "admin", "manager"];
const ADMIN_ROLES: Role[] = ["owner", "admin"];
// Cấp phát quyền hệ thống (gán App Admin/Group Admin cho 1 app con hoặc app nội
// bộ) là hành động nhạy cảm hơn vận hành hồ sơ nhân viên thường — theo mô hình
// Base Account, chỉ Owner được làm việc này, admin KHÔNG được tự phong người khác.
const OWNER_ROLES: Role[] = ["owner"];

export function isApprover(session: Session | null): boolean {
  return !!session?.profile && APPROVER_ROLES.includes(session.profile.role);
}

// Owner = cấp cao nhất, có đầy đủ quyền admin
export function isAdmin(session: Session | null): boolean {
  return !!session?.profile && ADMIN_ROLES.includes(session.profile.role);
}

export function isOwner(session: Session | null): boolean {
  return !!session?.profile && OWNER_ROLES.includes(session.profile.role);
}

export async function requireApprover(): Promise<Session> {
  const session = await requireSession();
  if (!isApprover(session)) throw new Error("Không có quyền thực hiện thao tác này");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireSession();
  if (!isAdmin(session)) throw new Error("Chỉ admin mới thực hiện được thao tác này");
  return session;
}

export async function requireOwner(): Promise<Session> {
  const session = await requireSession();
  if (!isOwner(session)) throw new Error("Chỉ owner mới thực hiện được thao tác này");
  return session;
}
