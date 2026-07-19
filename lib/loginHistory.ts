import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

/**
 * Ghi 1 dòng vào lịch sử đăng nhập (collection `login_history`). Ghi cả 3
 * loại: thành công, bị từ chối (chưa có hồ sơ users/{uid}), và thất bại (sai
 * mật khẩu, lỗi Google...). KHÔNG throw — lỗi ghi log không được chặn luồng
 * đăng nhập chính.
 */
export async function logLogin(entry: {
  uid: string | null;
  email: string;
  fullName: string | null;
  status: "success" | "rejected" | "failed";
  reason?: string | null;
  ip: string | null;
  userAgent: string | null;
  method?: "password" | "google" | null;
}): Promise<void> {
  try {
    await adminDb.collection("login_history").add({
      ...entry,
      reason: entry.reason ?? null,
      method: entry.method ?? null,
      createdAt: Timestamp.now(),
    });
  } catch (e) {
    console.error("[logLogin] ghi lịch sử đăng nhập thất bại (bỏ qua):", e);
  }
}

/** Lấy IP client từ header x-forwarded-for (phần tử đầu tiên) */
export function getClientIp(headers: Headers): string | null {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip");
}
