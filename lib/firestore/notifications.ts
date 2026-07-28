import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreNotification } from "./types";

// Tên RIÊNG cho Booking (không phải "notifications" dùng chung) — HPcons-booking
// và hpcons-portal chia sẻ CÙNG 1 project Firebase (FIREBASE_ADMIN_PROJECT_ID=
// hpcons-portal), nên nếu dùng chung tên collection, chuông của Booking sẽ vô
// tình hiện lẫn thông báo do hpcons-portal tạo (vd phản hồi góp ý) kèm link
// sai app (404 khi bấm). Tách riêng để 2 app không lẫn dữ liệu của nhau — xem
// design.md của change wire-notification-bell-and-preferences.
const COLLECTION = "booking_notifications";

export interface NotificationWithId extends FirestoreNotification {
  id: string;
}

export async function listNotificationsForUser(userId: string, limit = 30): Promise<NotificationWithId[]> {
  const snap = await adminDb
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreNotification) }));
}

/**
 * Cài đặt thông báo của 1 user (users/{uid}.settings.notificationSettings) —
 * thiếu field/khoá = coi như bật (true), để user chưa từng cấu hình không bị
 * mất thông báo nào. Đọc riêng từng uid xuất hiện trong `entries` (thường 1-3
 * người/lần gọi, không phải toàn công ty).
 */
async function loadNotificationSettingsFor(userIds: string[]): Promise<Map<string, Partial<Record<string, boolean>>>> {
  const unique = Array.from(new Set(userIds));
  const snaps = await Promise.all(unique.map((id) => adminDb.collection("users").doc(id).get()));
  const map = new Map<string, Partial<Record<string, boolean>>>();
  unique.forEach((id, i) => {
    map.set(id, (snaps[i].data()?.settings?.notificationSettings ?? {}) as Partial<Record<string, boolean>>);
  });
  return map;
}

export async function createNotifications(
  entries: Array<{ userId: string; title: string; body?: string | null; link?: string | null; type?: string }>,
): Promise<void> {
  if (entries.length === 0) return;
  const settingsByUser = await loadNotificationSettingsFor(entries.map((e) => e.userId));

  const batch = adminDb.batch();
  let hasWrite = false;
  for (const e of entries) {
    const type = e.type ?? "system";
    if (settingsByUser.get(e.userId)?.[type] === false) continue; // user đã tắt loại này

    const ref = adminDb.collection(COLLECTION).doc();
    const doc: FirestoreNotification = {
      userId: e.userId,
      title: e.title,
      body: e.body ?? null,
      link: e.link ?? null,
      type,
      isRead: false,
      createdAt: Timestamp.now(),
    };
    batch.set(ref, doc);
    hasWrite = true;
  }
  if (hasWrite) await batch.commit();
}

export async function getNotificationById(id: string): Promise<NotificationWithId | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreNotification) };
}

export async function markNotificationRead(id: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).update({ isRead: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const snap = await adminDb.collection(COLLECTION).where("userId", "==", userId).where("isRead", "==", false).get();
  if (snap.empty) return;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}

export function toNotificationJson(n: NotificationWithId) {
  return {
    id: n.id,
    user_id: n.userId,
    title: n.title,
    body: n.body,
    link: n.link,
    type: n.type,
    is_read: n.isRead,
    created_at: n.createdAt?.toDate?.().toISOString() ?? null,
  };
}
