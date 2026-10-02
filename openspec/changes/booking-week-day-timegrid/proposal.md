## Why

Sếp đang dựng demo đổi giao diện Booking theo bố cục Base Booking (`tong-quan-demo/HPCons-booking/doi-giao-dien-base-booking-2026-10-02-v03/`), và hỏi riêng về cách bấm vào 1 thời điểm trong ngày để ra khung giờ như bản tham chiếu `booking.base.vn`. Khảo sát lại mã nguồn cho thấy `WeekCalendar.tsx`/`DayCalendar.tsx` hiện tại là danh sách đăng ký sắp theo giờ bắt đầu trong mỗi cột ngày — KHÔNG có trục giờ trực quan. Đây là quyết định có chủ đích của đợt trước (`booking-calendar-limits-import/design.md`: "Không làm lịch dạng lưới giờ chi tiết... tránh over-engineer", "có thể nâng cấp UI sau nếu cần"). Sếp đã xem mockup lưới giờ bấm-chọn trong demo và duyệt hướng kết hợp: xây lưới giờ thật, đồng thời luôn có nút "+" rõ ràng trong khung giờ đã chọn để tạo nhanh (không chỉ dựa vào việc bấm đúng toạ độ).

Đây là 1 trong 6 quyết định của đặc tả lớn hơn "đổi giao diện Booking theo Base Booking" — 5 quyết định còn lại (nhãn tab, phạm vi tab "Tất cả", nguồn Quản lý trực tiếp, ACL tài nguyên, gộp nhóm phòng họp) CHƯA được duyệt và KHÔNG thuộc phạm vi đợt này.

## What Changes

- Thay cách hiển thị **Tuần** và **Ngày** của 1 tài nguyên: từ danh sách chip theo giờ sang **lưới giờ trực quan** (trục giờ cố định bên trái, booking đặt đúng vị trí/chiều cao theo `start_at`/`end_at` thật).
- Thêm tương tác **bấm vào ô giờ trống** → tính giờ theo toạ độ bấm, làm tròn về mốc 30 phút gần nhất, hiện khung chọn kèm nút "+" → mở `BookingFormDialog` hiện có, điền sẵn ngày/giờ bắt đầu-kết thúc đúng tài nguyên/khung đã chọn.
- Giữ nguyên toàn bộ tô màu theo trạng thái/tài nguyên đang dùng (`statusColors.ts`), không đổi ý nghĩa màu.
- Không đổi API `/api/bookings`, không đổi transaction chặn trùng lịch (`createBooking`), không đổi field/logic của `BookingFormDialog` — chỉ đổi cách hiển thị lịch và cách mở form kèm giờ điền sẵn.
- Giữ khả năng cuộn dọc trong lưới giờ; dưới 768px vẫn cho xem được (có thể giữ fallback danh sách cũ nếu lưới giờ không thao tác tốt trên cảm ứng — xem design.md).

## Capabilities

### New Capabilities
- `booking-calendar-timegrid`: Hiển thị Tuần/Ngày dạng lưới giờ trực quan cho 1 tài nguyên, kèm tương tác bấm-chọn khung giờ để mở nhanh biểu mẫu tạo đăng ký với giờ điền sẵn.

### Modified Capabilities
(không có capability nào đã archive vào `openspec/specs/` liên quan — `booking-calendar-limits-import` (đã thêm Tuần/Ngày dạng danh sách) vẫn đang ở trạng thái "change" chưa archive, nên đổi lần này coi là bổ sung capability mới thay vì sửa spec cũ)

## Impact

- `components/booking/WeekCalendar.tsx`: viết lại phần hiển thị — thêm trục giờ + định vị booking theo thời gian thật (giữ nguyên props `weekStart`, `bookings`, `onDayClick`, `onBookingClick`, thêm callback mới cho bấm-chọn khung giờ).
- `components/booking/DayCalendar.tsx`: viết lại tương tự cho 1 cột ngày full-width.
- `app/(booking)/bookings/page.tsx` (và trang tài nguyên tương ứng nếu khác): truyền thêm callback mở `BookingFormDialog` kèm start/end tính từ khung đã chọn.
- Không đổi `lib/firestore/bookings.ts`, không đổi `app/api/bookings/**`, không đổi `BookingFormDialog.tsx` field logic (chỉ nhận thêm prop giờ điền sẵn nếu component đó chưa hỗ trợ truyền sẵn start/end — kiểm tra lại trong design.md).
- Không ảnh hưởng dữ liệu production — không đổi schema Firestore, không đổi API.
