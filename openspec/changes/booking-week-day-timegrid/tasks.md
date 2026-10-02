## 1. Tiện ích tính toán lưới giờ (dùng chung Tuần + Ngày)

- [x] 1.1 Thêm hàm `getTimeAxisBounds(bookings, defaultStartHour=6, defaultEndHour=22)` (đặt riêng ở `components/booking/timeGridUtils.ts` thay vì trong `WeekCalendar.tsx` để `DayCalendar.tsx` không phải import chéo — thay đổi nhỏ so với kế hoạch ban đầu, không ảnh hưởng hành vi): trả về `{ startHour, endHour }`, tự giãn nếu có booking ngoài biên mặc định.
- [x] 1.2 Thêm hàm `packOverlappingEvents(dayBookings)`: input danh sách booking của 1 ngày (đã sort theo `start_at`), output mỗi booking kèm `{ col, colCount }` theo thuật toán đóng gói cột (interval column packing).
- [x] 1.3 Thêm hàm `pixelToMinutes`/`timeToPixel`/`computeSlotFromClickY` dùng chung cho việc định vị thẻ và tính giờ khi bấm.
- [x] 1.4 Kiểm bằng script Node độc lập (`packOverlappingEvents`): 0 trùng, 2 trùng, 3 trùng lồng nhau, 1 booking bao trùm nhiều booking ngắn — cả 4 case đều đúng (xem log kiểm tra đã báo Sếp).

## 2. WeekCalendar.tsx — lưới giờ

- [x] 2.1–2.8 Hoàn tất: 7 cột ngày dùng chung biên giờ cả tuần, trục giờ bên trái, thẻ đăng ký định vị theo giờ thật + xếp cột khi trùng, bấm ô trống hiện khung chọn kèm nút "+", đổi `onDayClick` → `onSlotClick`, đóng khung khi bấm ra ngoài/Esc/đổi tuần, cuộn ngang riêng trong lưới (không tràn trang).

## 3. DayCalendar.tsx — lưới giờ

- [x] 3.1–3.4 Hoàn tất: 1 cột lưới giờ full-width, cùng cơ chế bấm-chọn, giữ nút "Đặt lịch" làm lối vào mặc định 08:00–09:00.

## 4. Nối vào page.tsx

- [x] 4.1–4.5 Hoàn tất: thêm `pickerSlot`, nối `onSlotClick` cho cả 2 component, `handleResourcePicked` ưu tiên `pickerSlot`, Tháng không đổi hành vi (đã kiểm chứng thật).

## 5. Kiểm tra

- [x] 5.1 `npm run build` sạch — không lỗi TypeScript/build.
- [x] 5.2 Đã kiểm bằng script Node độc lập cho logic xếp cột (không tạo booking thật trùng giờ trên production để tránh tạo dữ liệu rác — xem mục 1.4); đã xác nhận qua Playwright + tài khoản test thật rằng việc bấm-chọn-mở form hoạt động đúng với dữ liệu tài nguyên thật.
- [x] 5.3 Đã bấm thử nhiều vị trí (Tuần: giữa ô → 12:30–13:30; Ngày: gần đầu giờ → 08:00–09:00) bằng Playwright + tài khoản test thật — giờ tính đúng, làm tròn 30 phút.
- [x] 5.4 Đã xác nhận bằng Playwright + tài khoản test thật: bấm "+" → `QuickBookModal` (2 bước) → `BookingFormDialog` mở đúng tài nguyên "Xe Công Ty", trường "Bắt đầu lúc"/"Kết thúc lúc" = đúng 30/09/2026 12:30–13:30 (khớp khung đã chọn, không còn 08:00–09:00 mặc định) — đã đóng bằng "Bỏ qua", KHÔNG lưu, không tạo dữ liệu thật.
- [x] 5.5 Đã kiểm bằng script Node độc lập: bounds tự giãn 5h–24h khi có booking ngoài 6h–22h (xem mục 1.4).
- [x] 5.6 Đã xác nhận bằng Playwright + tài khoản test thật: bấm ngày ở chế độ Tháng vẫn mở thẳng `QuickBookModal` như cũ, không đổi hành vi.
- [x] 5.7 Đã chụp ảnh thật ở 1024px/768px/390px: không tràn ngang toàn trang ở mọi mức (lưới giờ tự cuộn ngang riêng khi hẹp, đúng thiết kế).
- [x] 5.8 Đã báo Sếp kết quả kèm ảnh chụp thật (không phải mockup) trước khi coi là hoàn thành.

**Lưu ý khi kiểm chứng**: dùng tài khoản `claude.test@hpcore.internal` qua Playwright (đăng nhập thật qua Firebase Auth REST + đổi session cookie tại `/api/auth/session`, không bypass code thật) để xem đúng dữ liệu tài nguyên thật (Phòng họp lớn/nhỏ, Xe Triton/Xpander đều tên "Xe Công Ty", Xe Thuê ngoài thiếu dấu...) — khớp đúng các phát hiện đã nêu trong demo trước đó. Không tạo/lưu bất kỳ đăng ký nào trên dữ liệu thật trong lúc kiểm tra.
