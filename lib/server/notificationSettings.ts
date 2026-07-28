import "server-only";
import { adminDb } from "@/lib/firebase/admin";

export const NOTIFICATION_TYPES = [
  "booking_edited",
  "booking_approval",
  "booking_rejected",
  "booking_approved",
  "booking_cancelled",
  "comment_mention",
  "booking_upcoming",
  "booking_resource_closed",
] as const;

export type NotificationSettings = Record<(typeof NOTIFICATION_TYPES)[number], boolean>;

/** Thiếu field/khoá = coi như bật (true) — không cần backfill user cũ. */
export async function getNotificationSettings(uid: string): Promise<NotificationSettings> {
  const snap = await adminDb.collection("users").doc(uid).get();
  const stored = (snap.data()?.settings?.notificationSettings ?? {}) as Partial<NotificationSettings>;
  return NOTIFICATION_TYPES.reduce((acc, key) => {
    acc[key] = stored[key] !== false;
    return acc;
  }, {} as NotificationSettings);
}

/**
 * Dùng update() với dot-path cho từng khoá (không set() cả object settings)
 * để không ghi đè mất displayColor/delegation/... user đã cấu hình trước đó
 * trong cùng field `settings`.
 */
export async function updateNotificationSettings(
  uid: string,
  patch: Partial<NotificationSettings>,
): Promise<void> {
  const update: Record<string, boolean> = {};
  for (const key of NOTIFICATION_TYPES) {
    if (typeof patch[key] === "boolean") update[`settings.notificationSettings.${key}`] = patch[key];
  }
  if (Object.keys(update).length === 0) return;
  await adminDb.collection("users").doc(uid).update(update);
}
