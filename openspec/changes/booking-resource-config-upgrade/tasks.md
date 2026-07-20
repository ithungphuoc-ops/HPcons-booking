## 1. Data model

- [x] 1.1 Thêm `registrationType?: 'auto' | 'approval'` và `attachments?: {name,url}[]` vào `FirestoreBookingResource` trong `lib/firestore/types.ts`, kèm comment giải thích thiếu field = `'approval'`.

## 2. Logic duyệt

- [x] 2.1 Sửa `createBooking()` trong `lib/firestore/bookings.ts`: đọc `resource.registrationType`, nếu `=== 'auto'` thì bỏ qua tính `approvals`/gọi `notifyBookingApprover`, tạo booking với `status: 'approved'` ngay, log `"Tạo đặt lịch mới (tự động duyệt)"`.
- [x] 2.2 Giữ nguyên transaction chặn trùng lịch chạy cho CẢ hai loại `registrationType` — không rẽ nhánh bỏ qua bước này.

## 3. API tài nguyên

- [x] 3.1 `app/api/booking-resources/route.ts` (POST) và `[id]/route.ts` (PATCH): nhận thêm `registrationType` khi tạo/sửa tài nguyên, validate giá trị chỉ được `'auto'` hoặc `'approval'`.
- [x] 3.2 Tạo route mới `app/api/booking-resources/attachments/route.ts` theo mẫu `app/api/bookings/attachments/route.ts` (FormData upload, giới hạn 10MB/tệp, 5 tệp, `requireAdmin()`). (Ghi chú: dùng path `booking-resources/{session.uid}/...` thay vì `{resourceId}` — vì tài nguyên mới có thể chưa tồn tại lúc tải, cùng lý do route booking gốc dùng `session.uid` — xem comment trong file.)

## 4. UI quản trị tài nguyên

- [x] 4.1 Viết lại phần danh sách trong `components/booking/ManageResourcesPanel.tsx` thành bảng (cột: màu, tên, nhóm, loại đăng ký, quản lý, người theo dõi, trạng thái, thao tác).
- [x] 4.2 Thêm ô tìm kiếm theo tên + bộ lọc theo nhóm/trạng thái/loại đăng ký (lọc client-side trên dữ liệu đã tải).
- [x] 4.3 Thêm chọn `registrationType` (radio 2 lựa chọn, mặc định "Cần duyệt") trong form thêm/sửa tài nguyên; thêm badge cảnh báo màu cho tài nguyên "Tự động duyệt" trong bảng.
- [x] 4.4 Thêm khu vực upload/xem/xoá tệp đính kèm tài nguyên trong form thêm + sửa tài nguyên, gọi route ở 3.2.
- [x] 4.5 Đổi mọi nhãn hiển thị "Bật/Tắt" liên quan `isActive` của tài nguyên/nhóm thành "Mở/Đóng" (chỉ đổi text hiển thị).

## 5. Kiểm thử

- [x] 5.1 `npm run build` sạch (đã chạy, 0 lỗi TypeScript/build).
- [x] 5.1b Smoke test dev server (chưa đăng nhập): `GET /` → 307 (redirect login), `GET /api/booking-resources` → 401, `POST /api/booking-resources/attachments` → 403 — đúng như kỳ vọng, không có lỗi 500.
- [ ] 5.2 Test thủ công VỚI TÀI KHOẢN THẬT (cần Sếp hoặc trình duyệt thật, môi trường này không thao tác được UI): tạo tài nguyên `'auto'`, đặt lịch → xác nhận `status: 'approved'` ngay, không có thông báo duyệt nào được tạo.
- [ ] 5.3 Test thủ công: 2 booking trùng giờ trên cùng tài nguyên `'auto'` → xác nhận booking thứ 2 vẫn bị chặn đúng như tài nguyên `'approval'`.
- [ ] 5.4 Test thủ công: tài khoản `employee` thật thử tạo/sửa tài nguyên và upload attachment tài nguyên trên UI → xác nhận bị từ chối.
- [ ] 5.5 Test thủ công: tìm kiếm/lọc bảng tài nguyên hoạt động đúng với dữ liệu thật hiện có trên UI thật.
