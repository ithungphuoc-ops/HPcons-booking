## 1. Firestore index

- [x] 1.1 Tạo `firestore.indexes.json` (chưa tồn tại trong repo) với index cho collection `booking_notifications` (userId ASC, createdAt DESC) — đổi tên collection khỏi `notifications` dùng chung với hpcons-portal, xem design.md
- [ ] 1.2 Gửi Sếp link Firebase Console tự sinh index, xác nhận trạng thái "Enabled" trước khi coi route GET đã xong — **đã xác nhận bằng script debug là lỗi FAILED_PRECONDITION thật sự xảy ra, cần Sếp bấm link tạo index**

## 2. Route API chuông thông báo

- [x] 2.1 Tạo `app/api/notifications/route.ts` — `GET`: `requireSession()`, `listNotificationsForUser(uid)`, trả `{ notifications: [...toNotificationJson], unreadCount }`
- [x] 2.2 Tạo `app/api/notifications/[id]/route.ts` — `PATCH`: `requireSession()`, `getNotificationById(id)`, kiểm tra `userId === session.uid` (403 nếu không khớp), rồi `markNotificationRead(id)`
- [x] 2.3 Tạo `app/api/notifications/read-all/route.ts` — `PATCH`: `requireSession()`, `markAllNotificationsRead(uid)`
- [ ] 2.4 Kiểm thử thủ công: đăng nhập 2 tài khoản khác nhau, xác nhận chuông mỗi bên chỉ thấy thông báo của chính mình, đánh dấu đọc không ảnh hưởng người kia — **cần Sếp test sau khi index Enabled**

## 3. Cài đặt thông báo

- [x] 3.1 Thêm `notificationSettings?: Partial<Record<string, boolean>> | null` vào `FirestoreUserSettings` (`lib/firestore/types.ts`) — đặt trong `settings` hiện có (giống `delegation`), không phải field rời trên `FirestoreUser`
- [x] 3.2 Sửa `createNotifications()` trong `lib/firestore/notifications.ts`: đọc `settings.notificationSettings` của từng `userId` duy nhất trong `entries` trước khi build batch, bỏ qua entry nếu `settings[type] === false`
- [x] 3.3 Thêm UI cài đặt `app/(booking)/bookings/settings/notifications/page.tsx` — 8 toggle, gọi `app/api/notification-settings/route.ts` (mới) đọc/ghi qua `lib/server/notificationSettings.ts` (dot-path update, không ghi đè mất delegation/displayColor khác trong `settings`)

## 4. Kiểm thử tổng hợp

- [ ] 4.1 User chưa cấu hình gì → nhận đủ 8 loại như thiết kế ban đầu (default-on) — **cần test tài khoản thật**
- [ ] 4.2 User tắt `comment_mention` → được mention trong bình luận booking không tạo notification cho họ, người khác trong cùng lượt mention vẫn nhận bình thường — **cần test tài khoản thật**
- [x] 4.3 Xác nhận toàn bộ nơi gọi `createNotifications` (bookings.ts, comments.ts, reminders/route.ts, booking-resources/[id]/route.ts) không cần sửa cách xác định người nhận — chỉ hàm `createNotifications` tự lọc thêm (đã kiểm tra bằng `npm run build` sạch, không sửa các file gọi hàm này)
