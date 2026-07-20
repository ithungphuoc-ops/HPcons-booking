## Why

Tài liệu "HP Core Booking – 6 Giai Đoạn" yêu cầu mỗi Mục đích đăng ký có thể gắn một biểu mẫu tuỳ chỉnh riêng (vd "Mượn thiết bị" cần thêm trường "Tên thiết bị", "Số lượng"; "Công tác" cần thêm "Nơi đến", "Người duyệt chi phí"...). Hiện tại `purposeText` là ô nhập tự do (đổi theo yêu cầu Sếp tuần trước vì công ty chưa cấu hình danh sách mục đích nào) và danh sách `bookingPurposes` chỉ tồn tại như 1 trang quản trị CRUD riêng, không hề được dùng khi tạo booking. Đây là Đợt 2/5 trong lộ trình nâng cấp Booking, đã được Sếp xác nhận làm đúng theo tài liệu (quay lại danh sách quản trị + form riêng từng mục đích, giữ thêm lựa chọn "Khác" để nhập tự do khi cần).

## What Changes

- Mở rộng `FirestoreBookingPurpose` với `formSchema` (danh sách trường tuỳ chỉnh: nhãn, loại, bắt buộc, tuỳ chọn).
- Trang `/bookings/purposes` thêm trình thiết kế biểu mẫu: thêm/sửa/xoá trường, sắp xếp lại thứ tự bằng kéo-thả (HTML5 drag-and-drop, không thêm thư viện), xem trước form.
- `BookingFormDialog.tsx`: `purposeText` (ô nhập tự do) đổi lại thành `<select>` bind `bookingPurposes` thật + lựa chọn "Khác" (hiện lại ô nhập tự do khi chọn). Khi chọn 1 mục đích có `formSchema`, render động các trường tương ứng ngay dưới và validate bắt buộc.
- `FirestoreBooking` thêm `formData` lưu câu trả lời của các trường tuỳ chỉnh; hiển thị trong `BookingDetailDialog.tsx`.
- **BREAKING (hành vi, không phải schema)**: Mục đích không còn là ô nhập tự do mặc định — nếu công ty chưa cấu hình mục đích nào, người dùng chỉ còn lựa chọn "Khác" để nhập tự do (không mất khả năng nhập tự do, chỉ đổi từ mặc định sang phải chọn "Khác").

## Capabilities

### New Capabilities
- `booking-purpose-forms`: Quản lý danh sách mục đích đăng ký có cấu hình biểu mẫu tuỳ chỉnh riêng từng mục đích (trình thiết kế kéo-thả trường), và việc điền/lưu/hiển thị câu trả lời của các trường đó khi tạo booking.

### Modified Capabilities
(không có — capability `booking-resource-management` ở Đợt 1 không đổi requirement nào trong đợt này)

## Impact

- `lib/firestore/types.ts`: thêm `BookingFormFieldType`, `BookingFormField`, mở rộng `FirestoreBookingPurpose.formSchema` và `FirestoreBooking.formData`.
- `app/(booking)/bookings/purposes/page.tsx`: thêm UI trình thiết kế biểu mẫu.
- `components/booking/BookingFormDialog.tsx`: đổi mục đích từ free-text sang select + render trường động.
- `app/api/bookings/route.ts` (POST): nhận và validate `formData`.
- `components/booking/BookingDetailDialog.tsx`: hiển thị `formData` đã điền.
- Dữ liệu booking cũ (không có `formData`/mục đích cũ ghi ở `purposeText`) vẫn hiển thị đúng — `purposeText` vẫn được ưu tiên hiển thị nếu có, không bị xoá.
