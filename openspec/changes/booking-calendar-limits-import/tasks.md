## 1. Data model

- [x] 1.1 `lib/firestore/types.ts`: thêm `bookingWindow?: { startHour: number; endHour: number; blockedWeekdays?: number[] }` vào `FirestoreBookingResource` (thiếu field = không giới hạn).

## 2. Sửa đăng ký

- [x] 2.1 `lib/firestore/bookings.ts`: thêm `updateBookingCore(id, patch, actorUid)` — transaction riêng (copy pattern conflict-guard từ `createBooking`, loại trừ chính `id` đang sửa), validate `bookingWindow` của tài nguyên hiệu lực, nếu `startAt`/`endAt`/`resourceId` đổi thì tính lại `approvals` từ đầu (`status: 'pending'`, trừ tài nguyên `registrationType: 'auto'`); log `"Đã sửa đăng ký"` (kèm ghi chú riêng nếu core đổi).
- [x] 2.2 `app/api/bookings/[id]/route.ts` (PATCH): thêm nhánh `action: 'edit'`, kiểm tra quyền giống `DELETE` (chủ booking chưa diễn ra hoặc admin), gọi `updateBookingCore`, bắt `BookingConflictError`/`BookingWindowError`/`BookingFormValidationError`.
- [x] 2.3 `components/booking/BookingFormDialog.tsx`: thêm prop `editingBooking?` — tiêu đề đổi thành "Sửa đăng ký", nạp sẵn dữ liệu, ẩn 3 field không hỗ trợ sửa (quản lý trực tiếp/người theo dõi/tệp đính kèm), `submit()` gọi PATCH `action:'edit'` thay vì POST.
- [x] 2.4 `components/booking/BookingDetailDialog.tsx`: thêm nút "Sửa đăng ký" (chủ booking chưa diễn ra, hoặc admin) gọi `onEdit(detail)`; `app/(booking)/bookings/page.tsx` nhận và mở `BookingFormDialog` ở chế độ sửa.

## 3. Xem lịch Tuần/Ngày

- [x] 3.1 `components/booking/WeekCalendar.tsx` (mới): 7 ngày của tuần đang chọn, liệt kê đầy đủ booking mỗi ngày (không giới hạn 3 dòng như Tháng).
- [x] 3.2 `components/booking/DayCalendar.tsx` (mới): danh sách booking của 1 ngày, sắp theo giờ bắt đầu, có nút "Đăng ký" nhanh.
- [x] 3.3 `app/(booking)/bookings/page.tsx`: thêm `viewMode` (Tháng/Tuần/Ngày) + `anchorDate`, nút chuyển chế độ, điều hướng prev/next theo đúng đơn vị (tháng/tuần/ngày), tải dữ liệu đúng khoảng theo chế độ đang xem.

## 4. Giới hạn khung giờ

- [x] 4.1 `lib/firestore/bookings.ts`: `validateBookingWindow()` (kiểm tra giờ + ngày trong tuần) và `BookingWindowError`, dùng trong cả `createBooking` và `updateBookingCore`; `parseBookingWindow()` dùng chung ở 2 route API tài nguyên.
- [x] 4.2 `components/booking/ManageResourcesPanel.tsx`: thêm `BookingWindowPicker` (bật/tắt giới hạn, giờ bắt đầu/kết thúc, chọn ngày trong tuần bị chặn) trong form thêm + sửa tài nguyên.
- [x] 4.3 `app/api/booking-resources/route.ts` + `[id]/route.ts`: nhận/lưu `booking_window`; PATCH phân biệt `null` (xoá giới hạn qua `FieldValue.delete()`) và object (đặt giới hạn mới) — tránh bug `ignoreUndefinedProperties` bỏ qua update khi muốn xoá.

## 5. Nhập Excel

- [x] 5.1 `npm install xlsx` (chỉ dùng trong route API `app/api/bookings/import/route.ts`, không import vào Client Component nào — xác nhận qua build: route vẫn 170B, không kéo vào bundle client).
- [x] 5.2 Route `app/api/bookings/import/route.ts` (`requireAdmin`): parse `.xlsx`/`.xls` bằng `XLSX.read`, đọc cột Tên tài nguyên/Tiêu đề/Mục đích/Bắt đầu/Kết thúc (`dd/mm/yyyy hh:mm`); mỗi dòng khớp tên tài nguyên (không phân biệt hoa/thường, trim), khớp mục đích theo tên nếu có cấu hình (không khớp = "Khác"), gọi `createBooking()` sẵn có trong try/catch riêng từng dòng, gom `{ successCount, errors: [{row, message}] }`.
- [x] 5.3 UI `ExcelImportPanel` trong `ManageResourcesPanel.tsx`: nút chọn tệp, hiển thị số dòng thành công + danh sách lỗi kèm số dòng.

## 6. Kiểm thử

- [x] 6.1 `npm run build` sạch (đã chạy 4 lần qua các bước, 0 lỗi).
- [x] 6.2 Smoke test dev server (không login): `/bookings` → 307, `POST /api/bookings/import` → 403, `PATCH /api/bookings/xxx {action:'edit'}` → 401 — không route nào 500, log sạch.
- [ ] 6.3 Test thủ công VỚI TÀI KHOẢN THẬT (cần Sếp/trình duyệt thật): sửa 1 booking đã duyệt đổi giờ → xác nhận về lại chờ duyệt; sửa chỉ đổi mô tả → xác nhận giữ nguyên trạng thái duyệt.
- [ ] 6.4 Test thủ công: cấu hình giới hạn giờ cho 1 tài nguyên, thử đặt ngoài giờ/ngày bị chặn → xác nhận bị từ chối rõ ràng; tài nguyên không cấu hình vẫn đặt tự do.
- [ ] 6.5 Test thủ công: nhập file Excel mẫu có dòng đúng + dòng sai → xác nhận đúng số dòng tạo thành công + lỗi rõ ràng từng dòng sai.
- [ ] 6.6 Test thủ công: chuyển qua lại Tháng/Tuần/Ngày → dữ liệu hiển thị đúng ở cả 3 chế độ.
