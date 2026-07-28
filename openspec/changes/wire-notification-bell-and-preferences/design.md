## Context

`lib/firestore/notifications.ts` đã có đủ hàm CRUD cho 1 collection notification (`userId`, `title`, `body`, `link`, `type`, `isRead`, `createdAt`), và mọi nơi ghi thông báo (`bookings.ts`, `comments.ts`, `reminders/route.ts`, `booking-resources/[id]/route.ts`) đều đã nhắm đúng uid/danh sách cụ thể — không phải fan-out toàn công ty. Vấn đề thực sự nằm ở tầng đọc: `components/layout/NotificationBell.tsx` gọi 3 endpoint (`GET /api/notifications`, `PATCH /api/notifications/:id`, `PATCH /api/notifications/read-all`) mà `app/api/notifications/` **không tồn tại** — `ls app/api/` chỉ có `auth, booking-purposes, booking-resources, bookings, comments, member-groups, members, units`. Mọi route API khác trong repo đều xác thực qua `requireSession()` (`lib/session.ts`) rồi dùng `session.uid`.

**Phát hiện quan trọng lúc implement (đã xác nhận với Sếp):** `HPcons-booking` và `hpcons-portal` dùng CHUNG 1 Firebase project (`FIREBASE_ADMIN_PROJECT_ID=hpcons-portal` ở cả 2 repo). `lib/firestore/notifications.ts` của Booking là bản copy y hệt của hpcons-portal, cùng dùng tên collection `"notifications"` — nghĩa là 2 app đang ghi vào CHUNG 1 bảng dữ liệu vật lý. hpcons-portal đã tự tạo thông báo riêng (`lib/notifications.ts` → `notify()`, dùng ở `app/api/feedback/route.ts`) với `link` trỏ vào đường dẫn của hpcons-portal (vd `/dashboard/feedback/...`). Nếu Booking đọc thẳng theo `userId` như thiết kế ban đầu, chuông Booking sẽ hiện lẫn cả thông báo do hpcons-portal tạo, và bấm vào sẽ điều hướng sai (404) vì link không thuộc app Booking. **Quyết định: đổi tên collection Booking dùng thành `booking_notifications`** (tách hẳn khỏi bảng chung), không sửa gì phía hpcons-portal. Vì chuông Booking chưa từng hoạt động thật (route đọc chưa tồn tại), không ai từng thấy thông báo nào qua chuông này — đổi tên collection không làm mất kỳ vọng/dữ liệu nào của người dùng.

## Goals / Non-Goals

**Goals:**
- Chuông thông báo hoạt động thật: đọc đúng thông báo của user hiện tại, đánh dấu đã đọc từng cái hoặc tất cả.
- User tự bật/tắt được từng loại thông báo (8 loại `type` đang tồn tại trong code).
- Không đổi cách các nơi ghi thông báo xác định NGƯỜI NHẬN — chỉ thêm 1 bước lọc theo cài đặt trước khi ghi.

**Non-Goals:**
- Không đổi cấu trúc document `notifications` hiện có (field names giữ nguyên).
- Không thêm kênh thông báo mới (email/push) — chỉ chuông trong app.
- Không backfill `notificationSettings` cho user cũ — mặc định bật hết ở tầng đọc, không cần field tồn tại sẵn.

## Decisions

**1. 3 route API mới bám sát đúng những gì `NotificationBell.tsx` đã gọi sẵn** (không đổi component, chỉ implement server-side):
- `GET /api/notifications` → `requireSession()` lấy `uid`, gọi `listNotificationsForUser(uid)`, trả `{ notifications: [...toNotificationJson], unreadCount }` (đếm `isRead === false` trong kết quả).
- `PATCH /api/notifications/[id]` → `requireSession()`, kiểm tra `getNotificationById(id).userId === session.uid` trước khi `markNotificationRead(id)` (tránh user A đánh dấu đọc hộ thông báo của user B qua sửa URL).
- `PATCH /api/notifications/read-all` → `requireSession()`, gọi `markAllNotificationsRead(uid)`.

**2. Composite index bắt buộc, TRÊN COLLECTION MỚI `booking_notifications`:** `listNotificationsForUser` dùng `where("userId","==",userId).orderBy("createdAt","desc")` — 1 equality + 1 orderBy khác field = cần composite index (đã xác nhận thực nghiệm ở hpcons-portal cho `login_history`/`ai_guide_usage`, bất kể comment cũ nào nói khác). Vì đổi sang collection riêng (`booking_notifications`, xem Context), KHÔNG thể tái dùng index sẵn có của `notifications` (hpcons-portal) — phải tạo index mới. Thêm định nghĩa vào `firestore.indexes.json` (file này **chưa tồn tại** trong repo, sẽ tạo mới) để làm tài liệu, đồng thời xin Sếp bấm link Firebase Console tự sinh (CLI deploy không dùng được — thiếu quyền IAM, giới hạn đã biết).

**3. Lọc theo cài đặt tại thời điểm GHI, không phải lúc ĐỌC:** khác với app Request (lọc lúc đọc, vì Request không có bảng ghi thật) — Booking đã có bảng ghi thật nên lọc ngay trong `createNotifications()`: với mỗi entry, đọc `notificationSettings` của `entry.userId`, nếu `entry.type` bị tắt tường minh (`=== false`) thì bỏ qua, không tạo document. Giảm số document rác, và không cần sửa `listNotificationsForUser`/route đọc.

**4. Field cài đặt:** `notificationSettings?: Partial<Record<string, boolean>>` trên `users/{uid}` (dùng field `type` string trực tiếp làm khoá, ví dụ `{ comment_mention: false }`) — không cần enum riêng, khớp đúng 8 giá trị `type` đang tồn tại trong code, dễ mở rộng khi có `type` mới (mặc định bật nếu khoá không tồn tại).

**5. Đọc `notificationSettings` ở đâu trong `createNotifications`?** Hàm này nhận `entries: Array<{userId, ...}>` — cần đọc user doc của từng `userId` duy nhất trong mảng (thường 1-3 người/lần gọi, không phải toàn công ty) trước khi build batch, dùng `adminDb.collection("users").doc(userId).get()` — chấp nhận N read nhỏ, không cần cache thêm.

**Alternatives considered:** Lọc ở tầng đọc (giống Request-app) — bị loại vì Booking đã có bảng ghi thật, lọc sớm ở tầng ghi giúp collection gọn hơn và không phải sửa thêm route đọc vừa mới tạo.

## Risks / Trade-offs

- [Composite index chưa tạo lúc deploy] → Route sẽ trả lỗi `FAILED_PRECONDITION` khi gọi thật. Mitigation: tạo `firestore.indexes.json` + gửi Sếp link Console ngay khi code xong, test bằng script debug trực tiếp (pattern đã dùng nhiều lần trong session) trước khi coi là xong.
- [`markNotificationRead` không tự kiểm tra chủ sở hữu ở tầng lib] → Phải kiểm tra `userId === session.uid` ngay trong route (không sửa hàm lib dùng chung, tránh ảnh hưởng nơi khác nếu có).
- [User cũ chưa có `notificationSettings`] → Mặc định bật hết (không lọc gì) — không mất thông báo nào so với kỳ vọng ban đầu (dù thực tế trước giờ chưa ai nhận được gì vì bell hỏng).

## Migration Plan

- Deploy 3 route mới + sửa `createNotifications` cùng lúc.
- Tạo composite index trước khi deploy (hoặc chấp nhận lỗi tạm thời ở lần gọi đầu, xử lý ngay khi thấy log lỗi — theo đúng lesson đã áp dụng trước đây).
- Rollback: xoá 3 route mới (component tự fail âm thầm như hiện tại, không crash gì), revert `createNotifications`.

## Open Questions

(không có — phạm vi rõ ràng, dựa trên hạ tầng đã có sẵn)
