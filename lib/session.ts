import "server-only";
import { cookies } from "next/headers";
import { unstable_cache } from "next/cache";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { FirestoreUser, Role } from "@/lib/firestore/types";
import type { CachedUserWithId } from "@/lib/firestore/users";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/session-constants";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS };

export interface Session {
  uid: string;
  email: string;
  // null nếu tài khoản Firebase Auth chưa có document users/{uid} tương ứng
  // (chưa được HR/IT cấp quyền — xem app/api/auth/session/route.ts). Dùng
  // CachedUserWithId (createdAt: string) — xem getCachedProfile() dưới đây.
  profile: CachedUserWithId | null;
}

/**
 * Cache 30 giây (thêm 21/08/2026, sau sự cố hết hạn mức Firestore — Booking
 * dùng THẲNG project hpcons-portal, không phải project riêng, nên góp phần
 * trực tiếp vào đúng hạn mức bị hết): trước đây đọc SỐNG users/{uid} mỗi
 * lần xác minh phiên (mọi F5/chuyển trang). Đánh đổi: đổi vai trò/quyền
 * mất tới 30s mới có hiệu lực — chấp nhận được.
 */
const getCachedProfile = unstable_cache(
  async (uid: string): Promise<CachedUserWithId | null> => {
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) return null;
    const data = snap.data() as FirestoreUser;
    return { id: snap.id, ...data, createdAt: data.createdAt?.toDate?.().toISOString() ?? null };
  },
  ["booking-session-profile"],
  { revalidate: 30 },
);

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true);
    const profile = await getCachedProfile(decoded.uid);
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
