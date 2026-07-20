## Why

Đối chiếu tài liệu "HP Core Booking – 6 Giai Đoạn" (Giai đoạn 4) với Booking hiện tại: chưa thể sửa một đăng ký đã tạo (chỉ tạo/duyệt/từ chối/huỷ), lịch chỉ có view Tháng, tài nguyên chưa giới hạn được khung giờ được phép đặt, và không có cách nhập nhiều đăng ký cùng lúc (phải tạo tay từng cái). Đây là Đợt 3/5 của lộ trình nâng cấp Booking đã được Sếp duyệt. Phạm vi giới hạn khung giờ và mẫu Excel đã được Sếp xác nhận: giới hạn khung giờ tuỳ chọn theo từng tài nguyên (mặc định KHÔNG giới hạn), Excel dùng tên tài nguyên + ngày giờ dạng text, báo lỗi rõ từng dòng sai.

## What Changes

- Thêm chức năng **sửa đăng ký đã tạo** (title/thời gian/tài nguyên/mục đích/formData), chạy lại đúng transaction chặn trùng lịch (loại trừ chính nó), ghi log.
- Thêm view **Tuần** và **Ngày** cho lịch (bên cạnh Tháng đã có).
- Thêm **giới hạn khung giờ được phép đặt** theo từng tài nguyên (tuỳ chọn, mặc định không giới hạn): giờ bắt đầu/kết thúc trong ngày + ngày trong tuần bị chặn.
- Thêm **nhập hàng loạt từ Excel** (chỉ admin): cột Tên tài nguyên/Tiêu đề/Mục đích/Bắt đầu/Kết thúc, báo lỗi rõ từng dòng sai, dòng đúng vẫn tạo được.
- **BREAKING (dependency)**: thêm thư viện `xlsx` (SheetJS) vào `package.json` — thư viện mới đầu tiên từ khi tách Booking thành app riêng.

## Capabilities

### New Capabilities
- `booking-scheduling-limits`: Sửa đăng ký đã tạo, xem lịch theo Tuần/Ngày, giới hạn khung giờ được phép đặt theo tài nguyên, nhập hàng loạt đăng ký từ Excel.

### Modified Capabilities
(không có — không đổi requirement nào của `booking-resource-management` hay `booking-purpose-forms` đã ghi ở 2 đợt trước, chỉ thêm field mới optional)

## Impact

- `lib/firestore/types.ts`: thêm `bookingWindow?` vào `FirestoreBookingResource`.
- `lib/firestore/bookings.ts`: thêm `updateBookingCore()` (sửa đăng ký, chạy lại conflict-guard loại trừ chính nó), validate `bookingWindow` trong `createBooking`/sửa.
- `app/api/bookings/[id]/route.ts` (PATCH): thêm nhánh `action: 'edit'`.
- `components/booking/MonthCalendar.tsx`, thêm `WeekCalendar.tsx`, `DayCalendar.tsx`, toggle chế độ xem trong `app/(booking)/bookings/page.tsx`.
- `package.json`: thêm dependency `xlsx`.
- Route mới `app/api/bookings/import/route.ts` (chỉ admin) + UI nút nhập Excel.
- Không ảnh hưởng dữ liệu production hiện có — mọi field mới optional.
