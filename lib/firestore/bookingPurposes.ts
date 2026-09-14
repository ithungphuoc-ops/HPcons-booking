import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { unstable_cache, revalidateTag } from "next/cache";
import { adminDb } from "@/lib/firebase/admin";
import type { BookingFormDataEntry, BookingFormField, FirestoreBookingPurpose } from "./types";

const COLLECTION = "bookingPurposes";
const TAG_BOOKING_PURPOSES = "booking-purposes";

export interface BookingPurposeWithId extends FirestoreBookingPurpose {
  id: string;
}

// ⚠️ Xem quy ước hạn mức Firestore đầy đủ ở countBookingUsageByPurpose() bên dưới. Cache 60s vì
// collection nhỏ, do admin quản lý (giống users/departments đã cache trong app này) — có 4 hàm
// ghi bên dưới (createBookingPurpose/renameBookingPurpose/updateBookingPurposeFormSchema/
// toggleBookingPurpose), ĐỦ CẢ 4 đều revalidateTag() ngay khi ghi (rút kinh nghiệm từ lỗi thật
// vừa gặp ở app ITAsset cùng ngày: thiếu 1 điểm invalidate làm dữ liệu "vừa sửa không thấy ngay").
const layBookingPurposesDaCache = unstable_cache(
  async (): Promise<BookingPurposeWithId[]> => {
    // Chỉ orderBy trên Firestore (không kèm where) — kết hợp where("isActive")
    // + orderBy("name") cần composite index chưa tạo, gây FAILED_PRECONDITION
    // cho mọi user không phải admin (includeInactive=false). Lọc isActive ở code
    // thay vì Firestore — đúng pattern đã dùng xuyên suốt module này.
    const snap = await adminDb.collection(COLLECTION).orderBy("name").get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBookingPurpose) }));
  },
  ["booking-purposes-list"],
  { revalidate: 60, tags: [TAG_BOOKING_PURPOSES] },
);

export async function listBookingPurposes(includeInactive = false): Promise<BookingPurposeWithId[]> {
  const all = await layBookingPurposesDaCache();
  return includeInactive ? all : all.filter((p) => p.isActive);
}

export async function createBookingPurpose(name: string, createdBy: string): Promise<BookingPurposeWithId> {
  const existing = await adminDb.collection(COLLECTION).where("name", "==", name).limit(1).get();
  if (!existing.empty) throw new Error("Tên mục đích đã tồn tại");
  const doc: FirestoreBookingPurpose = { name, isActive: true, createdBy, createdAt: Timestamp.now() };
  const ref = await adminDb.collection(COLLECTION).add(doc);
  revalidateTag(TAG_BOOKING_PURPOSES);
  return { id: ref.id, ...doc };
}

export async function renameBookingPurpose(id: string, name: string): Promise<void> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Không tìm thấy mục đích");

  const existing = await adminDb.collection(COLLECTION).where("name", "==", name).limit(1).get();
  if (!existing.empty && existing.docs[0].id !== id) throw new Error("Tên mục đích đã tồn tại");

  await ref.update({ name });
  revalidateTag(TAG_BOOKING_PURPOSES);
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
  revalidateTag(TAG_BOOKING_PURPOSES);
}

export async function toggleBookingPurpose(id: string): Promise<boolean> {
  const ref = adminDb.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error("Không tìm thấy mục đích");
  const isActive = !(snap.data() as FirestoreBookingPurpose).isActive;
  await ref.update({ isActive });
  revalidateTag(TAG_BOOKING_PURPOSES);
  return isActive;
}

// ⚠️ QUY ƯỚC HẠN MỨC FIRESTORE — ghi lại sau sự cố RESOURCE_EXHAUSTED thật ở app Kho công trình
// (QLK CTR) ngày 13/09/2026 (gói Spark, trần 50.000 lượt đọc/ngày, 1 trang quét toàn bộ lịch sử
// không giới hạn/không cache làm sập cả app). Rà soát 14/09/2026 phát hiện hàm này (chạy mỗi lần
// F5 trang lịch chính VÀ mỗi lần đổi tháng/tuần/ngày — components/booking/... `load()`) quét TOÀN
// BỘ collection `bookings` (nhật ký đặt phòng, chỉ tăng theo thời gian) — không where/limit thu
// hẹp được vì mục đích hàm là ĐẾM CHÍNH XÁC theo từng mục đích, không thể cache/giới hạn mà không
// làm sai số.
//
// VÁ: đổi sang Firestore Aggregate Count Query (`.count().get()`) — CHỈ TRẢ VỀ 1 CON SỐ, KHÔNG
// đọc/tính phí theo từng document khớp (đọc kỹ tài liệu Firestore: aggregate count tính phí ~1 lượt
// đọc/nhóm 1000 document quét, RẺ HƠN đọc từng document rất nhiều, và không có trần kích thước kết
// quả). Chạy N truy vấn (N = số mục đích, nhỏ và ổn định — KHÔNG tăng theo lịch sử đặt phòng) thay
// vì 1 truy vấn đọc toàn bộ M booking (M tăng vô hạn theo thời gian) — đảo đúng biến số đang tăng
// không giới hạn (M) thành biến số ổn định (N).
export async function countBookingUsageByPurpose(): Promise<Map<string, number>> {
  const purposes = await listBookingPurposes(true);
  const counts = new Map<string, number>();
  await Promise.all(
    purposes.map(async (p) => {
      const agg = await adminDb.collection("bookings").where("purposeId", "==", p.id).count().get();
      const n = agg.data().count;
      if (n > 0) counts.set(p.id, n);
    }),
  );
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
