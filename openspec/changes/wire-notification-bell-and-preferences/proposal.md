## Why

Chuông thông báo (`components/layout/NotificationBell.tsx`) gọi `GET /api/notifications`, `PATCH /api/notifications/:id`, `PATCH /api/notifications/read-all` — nhưng cả 3 route này chưa từng được tạo trong `app/api/`, nên mọi lần tải chuông đều fetch lỗi âm thầm (catch rỗng), chuông luôn trống dù hạ tầng ghi dữ liệu (`lib/firestore/notifications.ts`, `createNotifications` gọi từ `bookings.ts`/`comments.ts`/`reminders`/`booking-resources`) đã ghi đúng người nhận từ lâu. Ngoài ra chưa ai tự tắt bớt được loại thông báo mình không cần.

## What Changes

- Tạo 3 route API còn thiếu, dựa thẳng trên các hàm đã có sẵn (`listNotificationsForUser`, `markNotificationRead`, `markAllNotificationsRead`, `toNotificationJson`) — không đổi cách ghi dữ liệu hiện có, chỉ thêm lớp đọc/API cho client.
- **Đổi tên collection Firestore Booking dùng từ `notifications` sang `booking_notifications`**: phát hiện lúc implement rằng HPcons-booking và hpcons-portal dùng chung 1 Firebase project, và collection `notifications` vốn đã bị hpcons-portal dùng riêng (vd thông báo phản hồi góp ý, link trỏ vào app portal) — nếu giữ chung tên, chuông Booking sẽ hiện lẫn thông báo sai app kèm link 404. Tách riêng tên để không đụng gì đến hpcons-portal đang chạy.
- Thêm composite index Firestore cho `booking_notifications` (`userId` ASC + `createdAt` DESC) — bắt buộc vì `listNotificationsForUser` dùng `where("userId","==",...)` kèm `orderBy("createdAt","desc")` trên field khác (bài học đã gặp với `login_history`/`ai_guide_usage` ở hpcons-portal).
- Thêm cài đặt thông báo cho user: bật/tắt riêng từng loại đang tồn tại (`booking_edited`, `booking_approval`, `booking_rejected`, `booking_approved`, `booking_cancelled`, `comment_mention`, `booking_upcoming`, `booking_resource_closed`). Lọc ngay tại thời điểm **ghi** trong `createNotifications` (bỏ qua entry nếu recipient đã tắt loại đó) — khác với app Request (lọc lúc đọc), vì booking đã có sẵn bảng ghi thật nên lọc sớm giúp collection không phình vô ích.
- Mặc định tất cả loại đều bật nếu user chưa từng cấu hình — không đổi hành vi hiện có (vốn dĩ chuông chưa chạy nên thực ra chưa ai "nhận" được gì, nhưng vẫn giữ nguyên tắc an toàn này).

## Capabilities

### New Capabilities
- `notification-bell-api`: các route API cho phép client đọc/đánh dấu đã đọc thông báo của chính mình, đúng theo những gì `NotificationBell.tsx` đã gọi sẵn.
- `notification-preferences`: user tự bật/tắt riêng từng loại thông báo; `createNotifications` tôn trọng cài đặt này khi ghi entry mới.

### Modified Capabilities
(không có — repo này chưa có spec nào trước đó)

## Impact

- Mới: `app/api/notifications/route.ts` (GET), `app/api/notifications/[id]/route.ts` (PATCH), `app/api/notifications/read-all/route.ts` (PATCH).
- Mới: composite index trong `firestore.indexes.json` cho `booking_notifications` (userId ASC, createdAt DESC) — cần user tạo qua Firebase Console link (không thể deploy CLI, theo giới hạn đã biết của project).
- Mới: field `notificationSettings?: Record<NotificationType, boolean>` trên `users/{uid}`, trang/khu vực cài đặt cho user tự bật/tắt.
- Sửa: `lib/firestore/notifications.ts` (`createNotifications`) — đọc `notificationSettings` của từng recipient trước khi ghi, bỏ qua nếu loại đó bị tắt.
- Không đổi: cách các nơi gọi `createNotifications` xác định NGƯỜI NHẬN (đã đúng target từ trước, không phải phạm vi vấn đề cần sửa).
