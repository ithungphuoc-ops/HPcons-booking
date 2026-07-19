import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreNotification } from "./types";

const COLLECTION = "notifications";

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

export async function createNotifications(
  entries: Array<{ userId: string; title: string; body?: string | null; link?: string | null; type?: string }>,
): Promise<void> {
  if (entries.length === 0) return;
  const batch = adminDb.batch();
  for (const e of entries) {
    const ref = adminDb.collection(COLLECTION).doc();
    const doc: FirestoreNotification = {
      userId: e.userId,
      title: e.title,
      body: e.body ?? null,
      link: e.link ?? null,
      type: e.type ?? "system",
      isRead: false,
      createdAt: Timestamp.now(),
    };
    batch.set(ref, doc);
  }
  await batch.commit();
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
