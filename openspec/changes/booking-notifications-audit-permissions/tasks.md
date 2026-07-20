## 1. Data model

- [x] 1.1 `lib/firestore/types.ts`: thêm `remindedUpcoming?: boolean` vào `FirestoreBooking`.

## 2. Thông báo vòng đời đăng ký

- [x] 2.1 `decideBooking()`: duyệt hoàn tất → thông báo "Đăng ký của bạn đã được duyệt"; từ chối → thông báo kèm lý do.
- [x] 2.2 `cancelBooking()`: nếu `actorUid !== booking.userId` (huỷ hộ) → thông báo cho người đặt.
- [x] 2.3 `updateBookingCore()`: nếu `actorUid !== booking.userId` (sửa hộ) → thông báo cho người đặt.

## 3. Thông báo sắp tới giờ

- [x] 3.1 `listBookingsStartingSoon(hoursAhead)` — lọc `status=='approved'` + `startAt` trong cửa sổ giờ + `!remindedUpcoming`.
- [x] 3.2 `app/api/bookings/reminders/route.ts`: gửi thông báo cho người đặt + follower, đánh dấu `remindedUpcoming: true` (cửa sổ 24h, khớp tần suất cron 1 lần/ngày).

## 4. Thông báo đóng tài nguyên

- [x] 4.1 `hasFutureBookingsForResource(resourceId)` — kiểm tra booking `pending`/`approved` tương lai.
- [x] 4.2 `app/api/booking-resources/[id]/route.ts` (PATCH): đóng tài nguyên có booking tương lai → thông báo `managerId` + `followerIds` của tài nguyên.

## 5. Nhật ký mở rộng

- [~] 5.1 **Đã bỏ qua có chủ đích**: collection `activity_logs` (kiểu `FirestoreActivityLog` có sẵn trong `types.ts` từ lúc copy code) không có bất kỳ trang/API nào trong app Booking đọc lại — ghi thêm vào đó sẽ là dữ liệu chỉ-ghi-không-ai-xem, không mang lại giá trị thực. Các sự kiện quan trọng đã có tín hiệu tương đương: đóng tài nguyên → thông báo trực tiếp (mục 4); nhập Excel → kết quả trả về ngay cho admin đang thao tác (Đợt 3). Nếu sau này Booking có trang "Nhật ký hoạt động" riêng, sẽ bổ sung lại.

## 6. Phân quyền "Quản lý tài nguyên"

- [x] 6.1 `app/api/booking-resources/[id]/route.ts`: đổi `requireAdmin()` thành `requireSession()` + kiểm tra thủ công — nhóm luôn cần admin; tài nguyên cho phép admin HOẶC `session.uid === resource.managerId` với `RESOURCE_MANAGER_ALLOWED_KEYS` (`type`, `isActive`, `attachments`, `follower_ids`) — từ chối 403 nếu gửi kèm field chính sách khác.
- [x] 6.2 `app/api/booking-resources/route.ts` (GET): bỏ điều kiện `isAdmin` khỏi `includeInactive=1` (mọi session đăng nhập đều xem được tài nguyên đã đóng — cần thiết để "Quản lý tài nguyên" thấy tài nguyên mình quản lý dù đang đóng để mở lại).
- [x] 6.3 `app/api/booking-resources/attachments/route.ts`: đổi từ `requireAdmin()` sang `requireSession()` (nhất quán với route tương tự của booking) — quyền THẬT vẫn kiểm tra ở bước PATCH gắn attachments vào tài nguyên.
- [x] 6.4 `components/booking/ManageResourcesPanel.tsx`: nhận thêm prop `isAdmin`/`myUserId`; non-admin chỉ thấy đúng tài nguyên mình quản lý trong bảng, ẩn "Thêm nhóm"/"Thêm tài nguyên"/nhập Excel/field chính sách (tên/màu/sức chứa/biển số/loại đăng ký/quản lý/giới hạn giờ) trong form sửa — chỉ giữ mở/đóng + người theo dõi + tệp đính kèm; `saveResourceEdit()` gửi payload rút gọn tương ứng.
- [x] 6.5 `app/(booking)/bookings/page.tsx`: tính `isResourceManagerOfAny`, hiện nút + panel "Quản lý tài nguyên" cho cả admin lẫn quản lý tài nguyên không phải admin.

## 7. Kiểm thử

- [x] 7.1 `npm run build` sạch.
- [x] 7.2 Smoke test dev server (không login): `GET /api/booking-resources?includeInactive=1` → 401, `PATCH /api/booking-resources/xxx` → 401 — không route nào 500, log sạch.
- [ ] 7.3 Test thủ công VỚI TÀI KHOẢN THẬT: duyệt hoàn tất/từ chối/huỷ hộ/sửa hộ → xác nhận đúng thông báo xuất hiện cho người đặt.
- [ ] 7.4 Test thủ công: đóng tài nguyên đang có booking tương lai → xác nhận quản lý + follower tài nguyên nhận thông báo; đóng tài nguyên không có booking tương lai → không có thông báo.
- [ ] 7.5 Test thủ công: tài khoản `employee` là `managerId` của 1 tài nguyên → thấy nút "Quản lý tài nguyên", đóng/mở được đúng tài nguyên đó, KHÔNG đổi được loại đăng ký/giới hạn giờ/tên; không thao tác được tài nguyên khác.
