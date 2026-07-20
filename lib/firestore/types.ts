import type { Timestamp } from "firebase-admin/firestore";

export type Role = "owner" | "admin" | "manager" | "employee";

/**
 * Trạng thái công tác của nhân viên (13/07/2026).
 * - active:      Đang làm việc (đăng nhập bình thường)
 * - maternity:   Tạm nghỉ – Thai sản (tạm khoá đăng nhập, có ngày dự kiến quay lại)
 * - on_leave:    Tạm nghỉ – Khác (ốm dài, không lương, việc riêng)
 * - transferred: Chuyển công tác sang công ty con khác (khoá)
 * - resigned:    Đã nghỉ việc (khoá vĩnh viễn, giữ lịch sử)
 * Chỉ "active" mới cho đăng nhập; các trạng thái khác → khoá tài khoản Auth.
 */
export type EmploymentStatus = "active" | "maternity" | "on_leave" | "transferred" | "resigned";

// doc id = Firebase Auth uid (giữ nguyên UID từ Supabase khi migrate)
export interface FirestoreUser {
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  departmentId: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  title: string | null;
  address: string | null;
  managerId: string | null;
  // Mã nhân viên (HP00xxx) — đồng bộ từ danh sách nhân sự HR (13/07/2026)
  employeeCode?: string | null;
  // Trạng thái công tác (13/07/2026). Thiếu field = coi như "active".
  employmentStatus?: EmploymentStatus;
  statusNote?: string | null;       // lý do / ghi chú
  statusSince?: string | null;      // ngày hiệu lực (YYYY-MM-DD)
  expectedReturn?: string | null;   // ngày dự kiến quay lại (thai sản / tạm nghỉ)
  transferTo?: string | null;       // nơi chuyển đến (chuyển công tác)
  // Cài đặt cá nhân trang Tài khoản (17/07/2026) — map JSON tự do, field thiếu
  // = dùng giá trị mặc định phía client (xem lib/profile-mock-data.ts).
  settings?: FirestoreUserSettings | null;
}

export interface FirestoreUserSettings {
  language?: string;
  timezone?: string;
  displayColor?: string;
  reminderDaysBefore?: number;
  reminderDaysAhead?: number;
  workSchedule?: Record<string, { id: string; start: string; end: string }[]>;
  delegation?: { delegateTo: string; fromDate: string; toDate: string } | null;
}

/**
 * Quyền của 1 nhân viên trong từng ứng dụng con (collection `app_permissions`,
 * docId = uid). Giá trị vai trò là CHUỖI TUỲ Ý do chính app con định nghĩa
 * (app tổng không hiểu/không giới hạn ý nghĩa) — vd PKD có 10 vai trò riêng
 * (sales, sales_manager, manager_legal...), ITAsset có 3 (admin, it_staff,
 * viewer). App tổng chỉ lưu trữ + hiển thị, KHÔNG định nghĩa cứng danh sách
 * hợp lệ cho bất kỳ app nào (xem openspec/changes/centralize-child-app-permissions).
 */
export type AppPermissionDoc = Record<string, string>;

/**
 * Nhóm thành viên (Member Group) — collection `memberGroups`. Nhóm LINH HOẠT
 * cắt ngang phòng ban (khác "đơn vị" — org-chart cứng, 1 người 1 đơn vị):
 * App Admin/Admin tự thêm/xoá thành viên bất kỳ, không ràng buộc theo cơ cấu
 * tổ chức. Mô hình Base Account: "App Admin quản trị Nhóm thành viên — thêm/
 * xoá thành viên, định hình phạm vi truy cập tài nguyên/dự án cắt ngang
 * phòng ban". Đợt này CHƯA tích hợp làm scope cho module Request (giữ
 * `requestGroups.scopeMode` độc lập như đã quyết định) — đây là 1 primitive
 * đứng riêng để dùng dần cho các tính năng sau.
 */
export interface MemberGroup {
  name: string;
  description: string | null;
  memberIds: string[];
  // Quản lý nhóm — bắt buộc phải là 1 phần tử của memberIds (xem
  // validateManagerInMembers ở lib/firestore/memberGroups.ts). null/undefined
  // = nhóm chưa có quản lý, chỉ Admin/Owner sửa được.
  managerId?: string | null;
  createdBy: string;
  createdAt: Timestamp;
}

/**
 * Nhật ký hoạt động quản trị — collection "activity_logs" (13/07/2026).
 * Phạm vi đợt 1: đổi vai trò nhân viên + đổi quyền ứng dụng con. Mở rộng dần
 * ở các đợt sau (duyệt đơn/booking/nhóm Telegram, đổi trưởng đơn vị...).
 * `action`/`entityType` là CHUỖI TỰ DO (không enum) — tránh phải sửa type mỗi
 * khi thêm loại hành động mới; đây là dữ liệu chỉ-đọc/hiển thị.
 */
export interface FirestoreActivityLog {
  actorUid: string;
  actorName: string;
  actorEmail: string;
  action: string;      // "Đổi vai trò" | "Đổi quyền ứng dụng" | ...
  entityType: string;  // "member" | "app_permission" | ...
  entityId: string;
  detail: string;       // tóm tắt dễ đọc, vd "Nguyễn Văn A: employee → manager"
  createdAt: Timestamp;
}

/**
 * Lịch sử đăng nhập app tổng — collection "login_history" (13/07/2026).
 * Ghi cả 3 loại: thành công, bị từ chối (đúng danh tính nhưng chưa có hồ sơ
 * users/{uid} — cơ chế "closed directory"), và thất bại (sai mật khẩu, lỗi
 * Google...). Không ghi khi verifyIdToken thất bại (chưa xác định được danh
 * tính — token giả mạo/hết hạn, khác với "gõ sai mật khẩu" ở phía client).
 */
export interface FirestoreLoginHistory {
  // null khi thất bại TRƯỚC lúc có danh tính Firebase (vd sai mật khẩu).
  uid: string | null;
  email: string;
  fullName: string | null;
  status: "success" | "rejected" | "failed";
  // Lý do thất bại (mã lỗi Firebase hoặc mô tả ngắn) — chỉ có khi status "failed".
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Timestamp;
  // Phương thức đăng nhập (17/07/2026) — thiếu field = bản ghi cũ trước khi có
  // trang "Lịch sử đăng nhập cá nhân", hiển thị "—".
  method?: "password" | "google" | null;
}

// Lịch sử thay đổi trạng thái công tác — collection "statusLogs"
export interface FirestoreStatusLog {
  userId: string;
  userName: string;
  fromStatus: EmploymentStatus;
  toStatus: EmploymentStatus;
  note: string | null;
  effectiveDate: string | null;
  expectedReturn: string | null;
  transferTo: string | null;
  changedByEmail: string;
  createdAt: Timestamp;
}

export interface FirestoreDepartment {
  name: string;
  description: string | null;
  createdAt: Timestamp;
  // Trưởng đơn vị (uid). "Quản lý trực tiếp" của thành viên = trưởng đơn vị này.
  leaderId?: string | null;
  // Đánh dấu ĐÚNG 1 phòng ban là "Nhân sự" (17/07/2026) — leaderId của phòng
  // này = "quản lý nhân sự", dùng làm cấp duyệt thứ 2 cho Booking (xem
  // lib/firestore/bookings.ts). Nếu nhiều phòng cùng đánh dấu, chỉ lấy 1
  // (không định nghĩa thứ tự ưu tiên).
  isHrDepartment?: boolean;
}

export type LocationType = "fixed" | "flexible";

export interface FirestoreWorksite {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: Timestamp;
  locationType: LocationType;
}

export type AttendanceStatus = "on_time" | "late" | "early_leave" | "absent" | "outside_range";

export interface FirestoreAttendance {
  userId: string;
  worksiteId: string;
  date: string; // YYYY-MM-DD
  checkInAt: Timestamp | null;
  checkOutAt: Timestamp | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  status: AttendanceStatus;
  note: string | null;
  createdAt: Timestamp;
  checkInPhotoUrl: string | null;
  checkOutPhotoUrl: string | null;
}

/**
 * Module Booking (nâng cấp 16/07/2026) — thay thế bản cũ room/vehicle cố định.
 * Cấu trúc: bookingGroups (nhóm, vd "Xe công tác", "Phòng họp") chứa nhiều
 * bookingResources.
 * Xem lib/firestore/bookings.ts.
 */
export interface FirestoreBookingGroup {
  name: string;
  icon: string; // khoá icon Lucide, vd "Car" | "Building2" | "Home" | "Truck" | "Package"
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Timestamp;
}

export interface FirestoreBookingResource {
  groupId: string;
  name: string;
  description: string | null;
  color: string; // hex dùng làm chấm màu nhận diện nhanh + màu sự kiện trên lịch
  capacity: number | null;
  plate: string | null;
  // KHÔNG CÒN dùng để xác định người duyệt (17/07/2026) — chuỗi duyệt giờ
  // theo tổ chức của người đặt (getDirectManagerId/getHrDepartmentLeaderId
  // trong lib/firestore/departments.ts), không theo tài nguyên. Giữ field
  // để không phá schema/UI cũ (ManageResourcesPanel), chỉ không đọc nữa khi
  // tạo booking — xem lib/firestore/bookings.ts createBooking().
  approverIds: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: Timestamp;
  // Người quản lý + người theo dõi RIÊNG của tài nguyên (18/07/2026) — khác
  // followerIds của từng booking. Chỉ để hiển thị thông tin ("ai phụ trách
  // tài nguyên này"), KHÔNG dùng cho chuỗi duyệt (xem comment approverIds ở trên).
  managerId?: string | null;
  followerIds?: string[];
  // Loại đăng ký (20/07/2026) — 'auto' bỏ qua toàn bộ chuỗi duyệt 2 cấp,
  // booking tạo ra được duyệt ngay (vẫn chặn trùng lịch bình thường). Thiếu
  // field (dữ liệu cũ) hoặc bất kỳ giá trị nào khác 'auto' đều xử lý như
  // 'approval' (giữ đúng hành vi hiện tại) — xem createBooking() trong
  // lib/firestore/bookings.ts.
  registrationType?: "auto" | "approval";
  // Tệp đính kèm CỦA TÀI NGUYÊN (20/07/2026, vd quy định sử dụng, sơ đồ) —
  // tách biệt hoàn toàn với attachments của từng booking (FirestoreBooking).
  attachments?: { name: string; url: string }[];
  // Giới hạn khung giờ được phép đặt (20/07/2026, tuỳ chọn) — thiếu field =
  // KHÔNG giới hạn (mặc định, theo xác nhận của Sếp). startHour/endHour dạng
  // số 0-24 (giờ trong ngày); blockedWeekdays dùng đúng convention
  // Date.getDay() (0=Chủ Nhật...6=Thứ Bảy). Validate ở createBooking() và
  // updateBookingCore() trong lib/firestore/bookings.ts.
  bookingWindow?: { startHour: number; endHour: number; blockedWeekdays?: number[] };
}

// Loại trường trong biểu mẫu tuỳ chỉnh theo mục đích (20/07/2026) — trình
// thiết kế kéo-thả ở app/(booking)/bookings/purposes/page.tsx.
export type BookingFormFieldType =
  | "text" | "textarea" | "number" | "date" | "select" | "multiselect" | "checkbox" | "file";

export interface BookingFormField {
  id: string; // sinh bằng crypto.randomUUID() phía client, dùng làm key kéo-thả + khoá formData
  label: string;
  type: BookingFormFieldType;
  required: boolean;
  options?: string[]; // chỉ dùng cho select/multiselect
}

export interface FirestoreBookingPurpose {
  name: string;
  isActive: boolean;
  createdBy: string | null;
  createdAt: Timestamp;
  // Biểu mẫu tuỳ chỉnh riêng của mục đích này (20/07/2026) — thiếu field
  // hoặc mảng rỗng = không có trường nào thêm khi chọn mục đích này.
  formSchema?: BookingFormField[];
}

// 1 mục đã điền của formData — LÀ SNAPSHOT tại thời điểm tạo booking, không
// phải map tra cứu theo formSchema hiện tại của mục đích (schema có thể đổi/
// xoá trường sau này, nhưng chi tiết booking cũ vẫn phải hiển thị đúng nhãn
// đã điền lúc đó — xem design.md Decision 4 của change
// booking-purpose-form-designer).
export interface BookingFormDataEntry {
  fieldId: string;
  label: string;
  type: BookingFormFieldType;
  value: string | number | boolean | string[] | { name: string; url: string } | null;
}

export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";
export type BookingApprovalStatus = "pending" | "waiting" | "approved" | "rejected";

export interface BookingApproval {
  approverId: string;
  level: number;
  status: BookingApprovalStatus;
  note: string | null;
  actedAt: Timestamp | null;
}

export interface BookingLogEntry {
  userId: string;
  action: string;
  at: Timestamp;
}

export interface FirestoreBooking {
  resourceId: string;
  userId: string;
  title: string;
  // Mục đích chọn từ danh sách quản trị (bookingPurposes) — quay lại thành
  // select bắt buộc chọn 1 trong 2 (mục đích thật HOẶC "Khác", 20/07/2026)
  // sau khi thêm trình thiết kế biểu mẫu theo mục đích. null khi người dùng
  // chọn "Khác" (nhập tự do ở purposeText).
  purposeId: string | null;
  // Mục đích gõ tay tự do — CHỈ có giá trị khi người dùng chọn "Khác" trong
  // select (20/07/2026). Ưu tiên hiển thị field này nếu có, xem
  // toBookingJson() trong lib/firestore/bookings.ts.
  purposeText?: string | null;
  note: string | null;
  destination: string | null;
  passengers: string | null;
  quantity: number | null;
  startAt: Timestamp;
  endAt: Timestamp;
  status: BookingStatus;
  approvals: BookingApproval[];
  followerIds: string[];
  logs: BookingLogEntry[];
  createdAt: Timestamp;
  // Tệp đính kèm (18/07/2026) — tải qua app/api/bookings/attachments/route.ts
  // TRƯỚC khi tạo booking (chưa có bookingId), URL gửi kèm lúc tạo.
  attachments?: { name: string; url: string }[];
  // Dữ liệu đã điền của các trường tuỳ chỉnh theo mục đích (20/07/2026) — là
  // SNAPSHOT tại thời điểm tạo, xem comment BookingFormDataEntry ở trên.
  formData?: BookingFormDataEntry[];
  // Đã gửi thông báo "sắp tới giờ" chưa (20/07/2026) — tránh nhắc trùng nhiều
  // lần cùng 1 booking qua các lần cron chạy (xem app/api/bookings/reminders).
  remindedUpcoming?: boolean;
}

/**
 * Bình luận dùng chung nhiều app con (collection "comments", 18/07/2026) —
 * polymorphic qua entityType/entityId, đúng convention đã có ở
 * FirestoreActivityLog (chuỗi tự do, không enum). Đọc trực tiếp qua Firestore
 * client SDK (real-time, xem lib/firebase/client.ts getFirebaseFirestore()),
 * ghi qua app/api/comments/** (Admin SDK) — xem
 * openspec/changes/add-comment-mentions-system/design.md.
 */
export interface FirestoreComment {
  entityType: string; // "booking" | ... (app sau này)
  entityId: string;
  authorId: string;
  text: string;
  // uid người HOẶC id nhóm/phòng ban được @mention — phân biệt bằng tra cứu
  // chéo lúc giãn thành thông báo (users -> memberGroups -> departments),
  // không tách mảng riêng (xem design.md Decision 5).
  mentionIds: string[];
  // Luôn trỏ về 1 bình luận GỐC (không có parentId riêng) — trả lời 1 cấp.
  parentId: string | null;
  createdAt: Timestamp;
  editedAt: Timestamp | null;
}

export interface FirestoreNotification {
  userId: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
  isRead: boolean;
  createdAt: Timestamp;
}

export type RequestType = "leave" | "overtime" | "business_trip" | "late_early" | "other";
export type RequestDayPart = "full" | "half";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface FirestoreRequest {
  userId: string;
  type: RequestType;
  startDate: string;
  endDate: string;
  dayPart: RequestDayPart;
  hours: number | null;
  minutes: number | null;
  location: string | null;
  reason: string;
  status: RequestStatus;
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface TelegramGroupMember {
  user_id: string;
  full_name: string;
}

export interface TelegramGroupResponsibility {
  user_id: string;
  full_name: string;
  resp: string;
  role: "Owner" | "Admin" | "Thành viên";
}

export type TelegramGroupFrequency = "daily" | "weekly" | "adhoc";
export type TelegramGroupStatus = "pending" | "approved" | "rejected";

export interface FirestoreTelegramGroupRequest {
  userId: string;
  groupName: string;
  purpose: string;
  regTitle: string;
  regDepartment: string;
  regProject: string | null;
  ownerId: string;
  members: TelegramGroupMember[];
  multiDept: boolean;
  hasOutsiders: boolean;
  outsiderDetail: string | null;
  deptGroup: boolean;
  responsibilities: TelegramGroupResponsibility[];
  frequency: TelegramGroupFrequency;
  status: TelegramGroupStatus;
  reviewerId: string | null;
  reviewNote: string | null;
  reviewedAt: Timestamp | null;
  createdAt: Timestamp;
}
