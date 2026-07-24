import "server-only";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getDirectManagerId, getHrDepartmentLeaderId } from "./departments";
import { getUserById } from "./users";
import { createNotifications } from "./notifications";
import type {
  FirestoreBookingGroup,
  FirestoreBookingResource,
  FirestoreBooking,
  BookingApproval,
  BookingStatus,
  BookingFormDataEntry,
} from "./types";

const GROUPS = "bookingGroups";
const RESOURCES = "bookingResources";
const BOOKINGS = "bookings";

// Số giờ (thực tế trôi qua, không phải giờ hành chính) 1 cấp duyệt được phép
// "pending" trước khi bị nhắc lại (Lớp 2) — xem app/api/bookings/reminders/route.ts.
export const REMINDER_THRESHOLD_HOURS = 8;

export interface BookingGroupWithId extends FirestoreBookingGroup {
  id: string;
}
export interface BookingResourceWithId extends FirestoreBookingResource {
  id: string;
}
export interface BookingWithId extends FirestoreBooking {
  id: string;
}

// ───────────────────────── Nhóm tài nguyên ─────────────────────────

export async function listBookingGroups(includeInactive = false): Promise<BookingGroupWithId[]> {
  // Lọc isActive ở code thay vì .where(...) kèm .orderBy(field khác) — tránh
  // phải tạo composite index riêng cho isActive + sortOrder (đã gặp lỗi này
  // trên production: FAILED_PRECONDITION thiếu index, làm sập cả trang Booking).
  const snap = await adminDb.collection(GROUPS).orderBy("sortOrder").get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBookingGroup) }));
  return includeInactive ? rows : rows.filter((r) => r.isActive);
}

export async function getBookingGroupById(id: string): Promise<BookingGroupWithId | null> {
  const snap = await adminDb.collection(GROUPS).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreBookingGroup) };
}

export async function createBookingGroup(data: {
  name: string;
  icon: string;
  description: string | null;
  sortOrder: number;
}): Promise<BookingGroupWithId> {
  const doc: FirestoreBookingGroup = { ...data, isActive: true, createdAt: Timestamp.now() };
  const ref = await adminDb.collection(GROUPS).add(doc);
  return { id: ref.id, ...doc };
}

export async function updateBookingGroup(id: string, patch: Partial<FirestoreBookingGroup>): Promise<void> {
  await adminDb.collection(GROUPS).doc(id).update(patch);
}

// ───────────────────────── Tài nguyên ─────────────────────────

export async function listBookingResources(includeInactive = false): Promise<BookingResourceWithId[]> {
  // Cùng lý do lọc ở code như listBookingGroups ở trên.
  const snap = await adminDb.collection(RESOURCES).orderBy("sortOrder").get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBookingResource) }));
  return includeInactive ? rows : rows.filter((r) => r.isActive);
}

export async function getBookingResourceById(id: string): Promise<BookingResourceWithId | null> {
  const snap = await adminDb.collection(RESOURCES).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreBookingResource) };
}

export async function createBookingResource(data: {
  groupId: string;
  name: string;
  description: string | null;
  color: string;
  capacity: number | null;
  plate: string | null;
  approverIds: string[];
  sortOrder: number;
  managerId?: string | null;
  followerIds?: string[];
  registrationType?: "auto" | "approval";
  bookingWindow?: FirestoreBookingResource["bookingWindow"];
}): Promise<BookingResourceWithId> {
  const doc: FirestoreBookingResource = { ...data, isActive: true, createdAt: Timestamp.now() };
  const ref = await adminDb.collection(RESOURCES).add(doc);
  return { id: ref.id, ...doc };
}

export async function updateBookingResource(
  id: string,
  // bookingWindow chấp nhận thêm FieldValue (xoá field hẳn khi tắt giới hạn
  // — cần FieldValue.delete() vì ignoreUndefinedProperties chỉ BỎ QUA field
  // undefined thay vì xoá nó, xem app/api/booking-resources/[id]/route.ts).
  patch: Partial<Omit<FirestoreBookingResource, "bookingWindow">> & {
    bookingWindow?: FirestoreBookingResource["bookingWindow"] | FieldValue;
  },
): Promise<void> {
  await adminDb.collection(RESOURCES).doc(id).update(patch);
}

// ───────────────────────── Booking ─────────────────────────

export async function listBookingsSince(since: Timestamp): Promise<BookingWithId[]> {
  const snap = await adminDb.collection(BOOKINGS).where("endAt", ">=", since).orderBy("endAt").orderBy("startAt").limit(500).get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as FirestoreBooking) }));
}

// Dùng cho lịch tháng (MonthCalendar) — tải đúng khoảng ngày đang hiển thị
// thay vì cố định 30 ngày. Lọc `startAt < end` ở code (không thêm range
// filter thứ 2 trên Firestore) để tái dùng đúng index đã có của listBookingsSince.
export async function listBookingsInRange(start: Timestamp, end: Timestamp): Promise<BookingWithId[]> {
  const snap = await adminDb.collection(BOOKINGS).where("endAt", ">=", start).orderBy("endAt").orderBy("startAt").limit(500).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as FirestoreBooking) }))
    .filter((b) => b.startAt.toMillis() < end.toMillis());
}

export async function getBookingById(id: string): Promise<BookingWithId | null> {
  const snap = await adminDb.collection(BOOKINGS).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreBooking) };
}

// Lỗi nghiệp vụ: khung giờ đã có booking pending/approved cùng tài nguyên.
// `POST /api/bookings` bắt lỗi này để trả HTTP 409 kèm đúng message cho người dùng.
export class BookingConflictError extends Error {
  constructor() {
    super("Khung giờ này đã có người đặt (đang chờ duyệt hoặc đã duyệt). Liên hệ quản lý nhân sự nếu cần xử lý.");
    this.name = "BookingConflictError";
  }
}

// Lỗi nghiệp vụ: booking nằm ngoài bookingWindow của tài nguyên (20/07/2026).
// Trả 400 (không phải 409 — đây không phải lỗi trùng lịch).
export class BookingWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingWindowError";
  }
}

// Parse + validate payload thô từ client thành bookingWindow hợp lệ (hoặc
// undefined nếu client không gửi/gửi rỗng — nghĩa là KHÔNG giới hạn). Dùng
// chung ở cả route tạo và sửa tài nguyên.
export function parseBookingWindow(raw: unknown): FirestoreBookingResource["bookingWindow"] {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as { startHour?: unknown; endHour?: unknown; blockedWeekdays?: unknown };
  const startHour = Number(r.startHour);
  const endHour = Number(r.endHour);
  if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || startHour >= endHour) return undefined;
  const blockedWeekdays = Array.isArray(r.blockedWeekdays)
    ? r.blockedWeekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)
    : undefined;
  return { startHour, endHour, blockedWeekdays: blockedWeekdays && blockedWeekdays.length > 0 ? blockedWeekdays : undefined };
}

// Kiểm tra startAt/endAt có nằm trong bookingWindow của tài nguyên không.
// Tài nguyên không cấu hình bookingWindow -> luôn hợp lệ (mặc định KHÔNG
// giới hạn, theo xác nhận của Sếp — xem design.md của change
// booking-calendar-limits-import). Dùng chung cho createBooking và
// updateBookingCore.
export function validateBookingWindow(
  resource: Pick<FirestoreBookingResource, "bookingWindow">,
  startAt: Timestamp,
  endAt: Timestamp,
): void {
  const w = resource.bookingWindow;
  if (!w) return;

  const start = startAt.toDate();
  const end = endAt.toDate();

  if (w.blockedWeekdays && w.blockedWeekdays.includes(start.getDay())) {
    throw new BookingWindowError("Tài nguyên này không nhận đặt lịch vào ngày trong tuần đã chọn.");
  }
  const startHourFloat = start.getHours() + start.getMinutes() / 60;
  const endHourFloat = end.getHours() + end.getMinutes() / 60;
  if (startHourFloat < w.startHour || endHourFloat > w.endHour) {
    throw new BookingWindowError(
      `Tài nguyên này chỉ nhận đặt lịch trong khung giờ ${w.startHour}h–${w.endHour}h.`,
    );
  }
}

export async function createBooking(
  data: Omit<FirestoreBooking, "status" | "approvals" | "followerIds" | "logs" | "createdAt">,
  opts?: {
    managerOverrideId?: string | null;
    registrationType?: "auto" | "approval";
    bookingWindow?: FirestoreBookingResource["bookingWindow"];
  },
): Promise<BookingWithId> {
  validateBookingWindow({ bookingWindow: opts?.bookingWindow }, data.startAt, data.endAt);

  // Tài nguyên 'auto' (20/07/2026) bỏ qua toàn bộ chuỗi duyệt bên dưới —
  // KHÔNG tính approverIds, KHÔNG gửi thông báo duyệt. Transaction chặn
  // trùng lịch ở dưới vẫn chạy y hệt cho cả 2 loại (xem design.md Decision 2
  // của change booking-resource-config-upgrade — không được phép bỏ qua
  // chặn trùng vì lý do registrationType).
  const isAutoApprove = opts?.registrationType === "auto";

  // Chuỗi duyệt theo tổ chức của NGƯỜI ĐẶT (không còn theo tài nguyên —
  // xem design.md Decision 2): cấp 1 = quản lý trực tiếp, cấp 2 = quản lý
  // nhân sự. Bỏ qua cấp không xác định được người (không chặn tạo booking).
  // Người đặt có thể tự chọn/đổi quản lý trực tiếp ngay trong form
  // (opts.managerOverrideId, 18/07/2026) — ưu tiên giá trị này nếu có,
  // thay vì luôn tự động tra theo phòng ban.
  const [autoManagerId, hrLeaderId] = isAutoApprove
    ? [null, null]
    : await Promise.all([getDirectManagerId(data.userId), getHrDepartmentLeaderId()]);
  const managerId = opts?.managerOverrideId ?? autoManagerId;
  const approverIds = isAutoApprove
    ? []
    : [managerId, hrLeaderId].filter((id, i, arr): id is string => !!id && arr.indexOf(id) === i);

  const ref = adminDb.collection(BOOKINGS).doc();

  await adminDb.runTransaction(async (tx) => {
    // Chặn cả 'pending' lẫn 'approved' — 2 request gần như đồng thời được
    // Firestore transaction xử lý tuần tự, request đến sau luôn thấy được
    // bản ghi của request đến trước (xem design.md Decision 1).
    // Chỉ lọc đúng 1 field (resourceId ==) trên Firestore — status/thời gian
    // lọc ở code — để không cần composite index (bài học lặp lại từ lỗi
    // FAILED_PRECONDITION đã gặp ở listBookingResources/listBookingGroups).
    const overlapSnap = await tx.get(
      adminDb.collection(BOOKINGS).where("resourceId", "==", data.resourceId),
    );
    const hasConflict = overlapSnap.docs.some((d) => {
      const b = d.data() as FirestoreBooking;
      if (b.status !== "pending" && b.status !== "approved") return false;
      return b.startAt.toMillis() < data.endAt.toMillis() && b.endAt.toMillis() > data.startAt.toMillis();
    });
    if (hasConflict) throw new BookingConflictError();

    const approvals: BookingApproval[] = approverIds.map((approverId, i) => ({
      approverId,
      level: i + 1,
      status: i === 0 ? "pending" : "waiting",
      note: null,
      actedAt: null,
    }));

    const doc: FirestoreBooking = {
      ...data,
      status: approvals.length === 0 ? "approved" : "pending",
      approvals,
      followerIds: [],
      logs: [{
        userId: data.userId,
        action: isAutoApprove ? "Tạo đặt lịch mới (tự động duyệt)" : "Tạo đặt lịch mới",
        at: Timestamp.now(),
      }],
      createdAt: Timestamp.now(),
    };
    tx.set(ref, doc);
  });

  const snap = await ref.get();
  const booking = { id: ref.id, ...(snap.data() as FirestoreBooking) };
  if (approverIds[0]) await notifyBookingApprover(approverIds[0], booking);
  return booking;
}

// Sửa 1 đăng ký đã tạo (tách biệt hoàn toàn khỏi decideBooking() — xem
// design.md Decision 1 của change booking-calendar-limits-import). Nếu giờ
// hoặc tài nguyên thực sự đổi, chuỗi duyệt được TÍNH LẠI TỪ ĐẦU (không giữ
// trạng thái đã duyệt cũ — Decision 2: đổi giờ/tài nguyên sau khi đã duyệt
// có thể khiến quyết định duyệt trước đó không còn hợp lệ). Sửa các field
// khác (tiêu đề/mục đích/formData/mô tả...) không đụng approvals/status.
export async function updateBookingCore(
  id: string,
  patch: {
    title?: string;
    resourceId?: string;
    startAt?: Timestamp;
    endAt?: Timestamp;
    purposeId?: string | null;
    purposeText?: string | null;
    formData?: BookingFormDataEntry[];
    note?: string | null;
    destination?: string | null;
    passengers?: string | null;
    quantity?: number | null;
  },
  actorUid: string,
): Promise<BookingWithId> {
  const booking = await getBookingById(id);
  if (!booking) throw new Error("Không tìm thấy booking");

  const effectiveResourceId = patch.resourceId ?? booking.resourceId;
  const effectiveStartAt = patch.startAt ?? booking.startAt;
  const effectiveEndAt = patch.endAt ?? booking.endAt;

  const resource = await getBookingResourceById(effectiveResourceId);
  if (!resource) throw new Error("Tài nguyên không hợp lệ");

  validateBookingWindow(resource, effectiveStartAt, effectiveEndAt);

  const coreChanged =
    effectiveResourceId !== booking.resourceId ||
    effectiveStartAt.toMillis() !== booking.startAt.toMillis() ||
    effectiveEndAt.toMillis() !== booking.endAt.toMillis();

  let newApprovals: BookingApproval[] | null = null;
  let newStatus: BookingStatus | null = null;
  let firstApproverId: string | null = null;

  if (coreChanged) {
    if (resource.registrationType === "auto") {
      newApprovals = [];
      newStatus = "approved";
    } else {
      const [autoManagerId, hrLeaderId] = await Promise.all([
        getDirectManagerId(booking.userId),
        getHrDepartmentLeaderId(),
      ]);
      const approverIds = [autoManagerId, hrLeaderId].filter(
        (v, i, arr): v is string => !!v && arr.indexOf(v) === i,
      );
      newApprovals = approverIds.map((approverId, i) => ({
        approverId,
        level: i + 1,
        status: i === 0 ? "pending" : "waiting",
        note: null,
        actedAt: null,
      }));
      newStatus = newApprovals.length === 0 ? "approved" : "pending";
      firstApproverId = approverIds[0] ?? null;
    }
  }

  const ref = adminDb.collection(BOOKINGS).doc(id);

  await adminDb.runTransaction(async (tx) => {
    // Cùng pattern chặn trùng của createBooking (1 field filter + lọc code),
    // loại trừ chính booking đang sửa.
    const overlapSnap = await tx.get(
      adminDb.collection(BOOKINGS).where("resourceId", "==", effectiveResourceId),
    );
    const hasConflict = overlapSnap.docs.some((d) => {
      if (d.id === id) return false;
      const b = d.data() as FirestoreBooking;
      if (b.status !== "pending" && b.status !== "approved") return false;
      return b.startAt.toMillis() < effectiveEndAt.toMillis() && b.endAt.toMillis() > effectiveStartAt.toMillis();
    });
    if (hasConflict) throw new BookingConflictError();

    const updatePatch: Partial<FirestoreBooking> = {
      title: patch.title ?? booking.title,
      resourceId: effectiveResourceId,
      startAt: effectiveStartAt,
      endAt: effectiveEndAt,
      purposeId: patch.purposeId !== undefined ? patch.purposeId : booking.purposeId,
      purposeText: patch.purposeText !== undefined ? patch.purposeText : booking.purposeText,
      formData: patch.formData !== undefined ? patch.formData : booking.formData,
      note: patch.note !== undefined ? patch.note : booking.note,
      destination: patch.destination !== undefined ? patch.destination : booking.destination,
      passengers: patch.passengers !== undefined ? patch.passengers : booking.passengers,
      quantity: patch.quantity !== undefined ? patch.quantity : booking.quantity,
      logs: [
        ...booking.logs,
        {
          userId: actorUid,
          action: coreChanged ? "Đã sửa đăng ký (giờ/tài nguyên đổi — cần duyệt lại)" : "Đã sửa đăng ký",
          at: Timestamp.now(),
        },
      ],
    };
    if (newApprovals !== null) {
      updatePatch.approvals = newApprovals;
      updatePatch.status = newStatus!;
    }

    tx.update(ref, updatePatch);
  });

  if (firstApproverId) {
    const updated = await getBookingById(id);
    if (updated) await notifyBookingApprover(firstApproverId, updated);
  }

  // Chỉ báo khi người SỬA HỘ khác với người đặt (vd admin sửa hộ) — tự sửa
  // đăng ký của chính mình không cần tự báo cho chính mình.
  if (actorUid !== booking.userId) {
    await createNotifications([{
      userId: booking.userId,
      title: "Đăng ký của bạn đã được sửa",
      body: `"${patch.title ?? booking.title}" đã được sửa.`,
      link: `/bookings?open=${id}`,
      type: "booking_edited",
    }]);
  }

  const finalDoc = await getBookingById(id);
  return finalDoc!;
}

export async function updateBooking(id: string, patch: Partial<FirestoreBooking>): Promise<void> {
  await adminDb.collection(BOOKINGS).doc(id).update(patch);
}

// Thông báo Lớp 1 (bắt buộc) — báo ngay lúc có booking cần approverId duyệt.
// Gọi lúc tạo booking (cấp 1), lúc decideBooking chuyển sang cấp kế tiếp, và
// (kèm reminder:true) từ route nhắc lại/leo thang (Lớp 2 + 3).
export async function notifyBookingApprover(
  approverId: string,
  booking: BookingWithId,
  opts?: { reminder?: boolean; onBehalfOfName?: string },
): Promise<void> {
  const requester = await getUserById(booking.userId);
  const base = `${requester?.fullName ?? "Một nhân viên"} vừa đặt "${booking.title}" — cần bạn duyệt.`;
  await createNotifications([
    {
      userId: approverId,
      title: opts?.reminder ? "Nhắc lại: có đặt lịch đang chờ bạn duyệt" : "Có đặt lịch cần bạn duyệt",
      body: opts?.onBehalfOfName ? `${base} (thay ${opts.onBehalfOfName} duyệt)` : base,
      link: `/bookings?open=${booking.id}`,
      type: "booking_approval",
    },
  ]);
}

// Booking đang 'pending' mà cấp duyệt hiện tại đã chờ quá REMINDER_THRESHOLD_HOURS
// kể từ lúc bắt đầu chờ (createdAt nếu là cấp 1, actedAt của cấp trước nếu là cấp sau).
export async function listBookingsNeedingReminder(): Promise<
  Array<{ booking: BookingWithId; approval: BookingApproval }>
> {
  const snap = await adminDb.collection(BOOKINGS).where("status", "==", "pending").get();
  const now = Date.now();
  const results: Array<{ booking: BookingWithId; approval: BookingApproval }> = [];

  for (const d of snap.docs) {
    const booking = { id: d.id, ...(d.data() as FirestoreBooking) };
    const current = booking.approvals.find((a) => a.status === "pending");
    if (!current) continue;

    const prevApproval = booking.approvals.find((a) => a.level === current.level - 1);
    const waitingSinceMs = (prevApproval?.actedAt ?? booking.createdAt).toMillis();
    const hoursWaiting = (now - waitingSinceMs) / 3_600_000;
    if (hoursWaiting >= REMINDER_THRESHOLD_HOURS) results.push({ booking, approval: current });
  }

  return results;
}

// Booking 'approved' bắt đầu trong vòng `hoursAhead` giờ tới, chưa từng được
// nhắc "sắp tới giờ" (xem design.md Decision 2 của change
// booking-notifications-audit-permissions). Lọc 1 field (status ==) trên
// Firestore, lọc startAt/remindedUpcoming ở code — đúng pattern module này.
export async function listBookingsStartingSoon(hoursAhead: number): Promise<BookingWithId[]> {
  const snap = await adminDb.collection(BOOKINGS).where("status", "==", "approved").get();
  const now = Date.now();
  const windowMs = hoursAhead * 3_600_000;
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as FirestoreBooking) }))
    .filter((b) => {
      if (b.remindedUpcoming) return false;
      const startMs = b.startAt.toMillis();
      return startMs > now && startMs - now <= windowMs;
    });
}

// Booking 'pending'/'approved' TƯƠNG LAI (chưa diễn ra) trên 1 tài nguyên —
// dùng để quyết định có cần báo cho quản lý/follower tài nguyên khi đóng hay
// không (xem app/api/booking-resources/[id]/route.ts).
export async function hasFutureBookingsForResource(resourceId: string): Promise<boolean> {
  const snap = await adminDb.collection(BOOKINGS).where("resourceId", "==", resourceId).get();
  const now = Date.now();
  return snap.docs.some((d) => {
    const b = d.data() as FirestoreBooking;
    return (b.status === "pending" || b.status === "approved") && b.startAt.toMillis() > now;
  });
}

// Duyệt theo cấp: activeUid phải trùng approverId của approval đang 'pending',
// hoặc isAdminOverride=true (admin/owner ép duyệt hết, kể cả cấp chưa tới lượt).
export async function decideBooking(
  id: string,
  actorUid: string,
  action: "approve" | "reject",
  note: string | null,
  isAdminOverride: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const booking = await getBookingById(id);
  if (!booking) return { ok: false, error: "Không tìm thấy booking" };
  if (booking.status !== "pending") return { ok: false, error: "Booking đã được xử lý" };

  const myApproval = booking.approvals.find((a) => a.approverId === actorUid && a.status === "pending");
  if (!myApproval && !isAdminOverride) {
    return { ok: false, error: "Bạn không có quyền duyệt hoặc đã xử lý rồi" };
  }

  const approvals = [...booking.approvals];
  const logs = [...booking.logs];

  if (action === "reject") {
    for (const a of approvals) {
      if (a.status === "pending" || a.status === "waiting") {
        a.status = "rejected";
        if (a.approverId === actorUid) { a.note = note; a.actedAt = Timestamp.now(); }
      }
    }
    logs.push({ userId: actorUid, action: note ? `Từ chối: ${note}` : "Từ chối", at: Timestamp.now() });
    await updateBooking(id, { status: "rejected", approvals, logs });
    await createNotifications([{
      userId: booking.userId,
      title: "Đăng ký của bạn bị từ chối",
      body: note ? `"${booking.title}" bị từ chối. Lý do: ${note}` : `"${booking.title}" bị từ chối.`,
      link: `/bookings?open=${id}`,
      type: "booking_rejected",
    }]);
    return { ok: true };
  }

  // action === "approve"
  let next: BookingApproval | undefined;
  if (myApproval) {
    myApproval.status = "approved";
    myApproval.note = note;
    myApproval.actedAt = Timestamp.now();
    next = approvals.find((a) => a.level === myApproval.level + 1 && a.status === "waiting");
    if (next) next.status = "pending";
  }

  const remaining = approvals.filter((a) => a.status === "pending" || a.status === "waiting");
  const allDone = remaining.length === 0 || isAdminOverride;

  if (allDone) {
    if (isAdminOverride) {
      for (const a of approvals) {
        if (a.status === "pending" || a.status === "waiting") { a.status = "approved"; a.actedAt = Timestamp.now(); }
      }
    }
    logs.push({ userId: actorUid, action: "Duyệt hoàn tất", at: Timestamp.now() });
    await updateBooking(id, { status: "approved", approvals, logs });
    await createNotifications([{
      userId: booking.userId,
      title: "Đăng ký của bạn đã được duyệt",
      body: `"${booking.title}" đã được duyệt hoàn tất.`,
      link: `/bookings?open=${id}`,
      type: "booking_approved",
    }]);
  } else {
    logs.push({ userId: actorUid, action: `Duyệt cấp ${myApproval?.level ?? ""}`, at: Timestamp.now() });
    await updateBooking(id, { approvals, logs });
    if (next) await notifyBookingApprover(next.approverId, { ...booking, approvals, logs });
  }

  return { ok: true };
}

export async function cancelBooking(id: string, actorUid: string): Promise<void> {
  const booking = await getBookingById(id);
  if (!booking) return;
  await updateBooking(id, {
    status: "cancelled",
    logs: [...booking.logs, { userId: actorUid, action: "Đã hủy đặt lịch", at: Timestamp.now() }],
  });
  // Chỉ báo khi người HUỶ HỘ khác với người đặt (vd admin huỷ hộ) — tự huỷ
  // đăng ký của chính mình không cần tự báo cho chính mình.
  if (actorUid !== booking.userId) {
    await createNotifications([{
      userId: booking.userId,
      title: "Đăng ký của bạn đã bị huỷ",
      body: `"${booking.title}" đã bị huỷ.`,
      link: `/bookings?open=${id}`,
      type: "booking_cancelled",
    }]);
  }
}

export async function toggleFollow(id: string, userId: string): Promise<{ following: boolean }> {
  const booking = await getBookingById(id);
  if (!booking) throw new Error("Không tìm thấy booking");
  const isFollowing = booking.followerIds.includes(userId);
  await adminDb.collection(BOOKINGS).doc(id).update({
    followerIds: isFollowing ? FieldValue.arrayRemove(userId) : FieldValue.arrayUnion(userId),
  });
  return { following: !isFollowing };
}

// Tìm booking đã duyệt của cùng resource bị trùng khung giờ (loại trừ chính nó)
export async function findApprovedConflict(
  resourceId: string,
  startAt: Timestamp,
  endAt: Timestamp,
  excludeId: string,
): Promise<BookingWithId | null> {
  // Chỉ lọc resourceId == trên Firestore, lọc status/thời gian ở code —
  // tránh cần composite index (cùng lý do đã sửa ở createBooking()).
  const snap = await adminDb.collection(BOOKINGS).where("resourceId", "==", resourceId).get();
  for (const d of snap.docs) {
    if (d.id === excludeId) continue;
    const b = d.data() as FirestoreBooking;
    if (b.status !== "approved") continue;
    if (b.startAt.toMillis() < endAt.toMillis() && b.endAt.toMillis() > startAt.toMillis()) {
      return { id: d.id, ...b };
    }
  }
  return null;
}

// ───────────────────────── JSON helpers ─────────────────────────

export function toBookingGroupJson(g: BookingGroupWithId) {
  return {
    id: g.id,
    name: g.name,
    icon: g.icon,
    description: g.description,
    sort_order: g.sortOrder,
    is_active: g.isActive,
  };
}

export function toBookingResourceJson(r: BookingResourceWithId) {
  return {
    id: r.id,
    group_id: r.groupId,
    name: r.name,
    description: r.description,
    color: r.color,
    capacity: r.capacity,
    plate: r.plate,
    approver_ids: r.approverIds,
    is_active: r.isActive,
    manager_id: r.managerId ?? null,
    follower_ids: r.followerIds ?? [],
    registration_type: r.registrationType === "auto" ? "auto" : "approval",
    attachments: r.attachments ?? [],
    booking_window: r.bookingWindow ?? null,
  };
}

export function toBookingJson(
  b: BookingWithId,
  userMap: Map<string, { full_name: string; email: string; title?: string | null; department?: string | null }>,
  resourceMap: Map<string, { id: string; group_id: string; name: string; color: string; description?: string | null; manager_id?: string | null; follower_ids?: string[] }>,
  purposeMap: Map<string, string>,
) {
  const resourceEntry = resourceMap.get(b.resourceId);
  const resource = resourceEntry
    ? {
        ...resourceEntry,
        manager_name: resourceEntry.manager_id ? userMap.get(resourceEntry.manager_id)?.full_name ?? null : null,
        followers: (resourceEntry.follower_ids ?? []).map((id) => ({ id, name: userMap.get(id)?.full_name ?? id })),
      }
    : null;

  return {
    id: b.id,
    resource_id: b.resourceId,
    user_id: b.userId,
    title: b.title,
    purpose_id: b.purposeId,
    purpose_name: b.purposeText ?? (b.purposeId ? purposeMap.get(b.purposeId) ?? null : null),
    note: b.note,
    destination: b.destination,
    passengers: b.passengers,
    quantity: b.quantity,
    start_at: b.startAt?.toDate?.().toISOString() ?? null,
    end_at: b.endAt?.toDate?.().toISOString() ?? null,
    status: b.status,
    resource,
    user: userMap.get(b.userId) ?? null,
    attachments: b.attachments ?? [],
    form_data: b.formData ?? [],
    followers: b.followerIds.map((id) => ({ id, name: userMap.get(id)?.full_name ?? id, title: userMap.get(id)?.title ?? null })),
    approvals: b.approvals.map((a) => ({
      approver_id: a.approverId,
      approver_name: userMap.get(a.approverId)?.full_name ?? a.approverId,
      approver_title: userMap.get(a.approverId)?.title ?? null,
      level: a.level,
      status: a.status,
      note: a.note,
      acted_at: a.actedAt?.toDate?.().toISOString() ?? null,
    })),
    logs: b.logs.map((l) => ({
      user_id: l.userId,
      actor_name: userMap.get(l.userId)?.full_name ?? l.userId,
      action: l.action,
      created_at: l.at?.toDate?.().toISOString() ?? null,
    })),
  };
}
