import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { BookingFormDataEntry, BookingFormField, FirestoreBookingPurpose } from "./types";

const COLLECTION = "bookingPurposes";

export interface BookingPurposeWithId extends FirestoreBookingPurpose {
  id: string;
}

// Chỉ orderBy trên Firestore (không kèm where) — kết hợp where("isActive")
// + orderBy("name") cần composite index chưa tạo, gây FAILED_PRECONDITION
// cho mọi user không phải admin (includeInactive=false). Lọc isActive ở code
// thay vì Firestore — đúng pattern đã dùng xuyên suốt module này.
export async function listBookingPurposes(includeInactive = false): Promise<BookingPurposeWithId[]> {
  const snap = await adminDb.collection(COLLECTION).orderBy("name").get();
  const all = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBookingPurpose) }));
  return includeInactive ? all : all.filter((p) => p.isActive);
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

export async function getBookingPurposeById(id: string): Promise<BookingPurposeWithId | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreBookingPurpose) };
}

export async function updateBookingPurposeFormSchema(id: string, formSchema: BookingFormField[]): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Không tìm thấy mục đích");
  await ref.update({ formSchema });
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

export class BookingFormValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingFormValidationError";
  }
}

// Validate + xây snapshot formData theo ĐÚNG formSchema của mục đích tại
// thời điểm gọi — dùng chung cho tạo (POST /api/bookings) và sửa (PATCH
// .../[id] action=edit), không tin việc client đã validate đủ (20/07/2026).
export async function buildValidatedFormData(
  purposeId: string | null | undefined,
  rawFormData: { fieldId?: string; label?: string; type?: string; value?: unknown }[],
): Promise<BookingFormDataEntry[]> {
  if (!purposeId) return [];
  const purpose = await getBookingPurposeById(purposeId);
  const schema = purpose?.formSchema ?? [];
  const byId = new Map(rawFormData.map((f) => [f.fieldId, f]));

  for (const field of schema) {
    const value = byId.get(field.id)?.value;
    const empty = value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    if (field.required && empty) throw new BookingFormValidationError(`Vui lòng điền "${field.label}"`);
  }

  return schema
    .filter((field) => {
      const value = byId.get(field.id)?.value;
      return !(value === undefined || value === null || value === "");
    })
    .map((field) => ({
      fieldId: field.id,
      label: field.label,
      type: field.type,
      value: byId.get(field.id)!.value as BookingFormDataEntry["value"],
    }));
}

export function toBookingPurposeJson(p: BookingPurposeWithId, creatorName: string | null, count: number) {
  return {
    id: p.id,
    name: p.name,
    is_active: p.isActive,
    creator_name: creatorName,
    count,
    form_schema: p.formSchema ?? [],
  };
}
