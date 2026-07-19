import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { FirestoreBookingPurpose } from "./types";

const COLLECTION = "bookingPurposes";

export interface BookingPurposeWithId extends FirestoreBookingPurpose {
  id: string;
}

export async function listBookingPurposes(includeInactive = false): Promise<BookingPurposeWithId[]> {
  let q = adminDb.collection(COLLECTION).orderBy("name") as FirebaseFirestore.Query;
  if (!includeInactive) q = q.where("isActive", "==", true);
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBookingPurpose) }));
}

export async function createBookingPurpose(name: string, createdBy: string): Promise<BookingPurposeWithId> {
  const existing = await adminDb.collection(COLLECTION).where("name", "==", name).limit(1).get();
  if (!existing.empty) throw new Error("Tên mục đích đã tồn tại");
  const doc: FirestoreBookingPurpose = { name, isActive: true, createdBy, createdAt: Timestamp.now() };
  const ref = await adminDb.collection(COLLECTION).add(doc);
  return { id: ref.id, ...doc };
}

export async function renameBookingPurpose(id: string, name: string): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Không tìm thấy mục đích");

  const existing = await adminDb.collection(COLLECTION).where("name", "==", name).limit(1).get();
  if (!existing.empty && existing.docs[0].id !== id) throw new Error("Tên mục đích đã tồn tại");

  await ref.update({ name });
}

export async function toggleBookingPurpose(id: string): Promise<boolean> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Không tìm thấy mục đích");
  const isActive = !(snap.data() as FirestoreBookingPurpose).isActive;
  await ref.update({ isActive });
  return isActive;
}

export async function countBookingUsageByPurpose(): Promise<Map<string, number>> {
  const snap = await adminDb.collection("bookings").where("purposeId", "!=", null).get();
  const counts = new Map<string, number>();
  for (const d of snap.docs) {
    const purposeId = d.data().purposeId as string;
    counts.set(purposeId, (counts.get(purposeId) ?? 0) + 1);
  }
  return counts;
}

export function toBookingPurposeJson(p: BookingPurposeWithId, creatorName: string | null, count: number) {
  return {
    id: p.id,
    name: p.name,
    is_active: p.isActive,
    creator_name: creatorName,
    count,
  };
}
