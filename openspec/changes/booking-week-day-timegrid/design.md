## Context

`WeekCalendar.tsx`/`DayCalendar.tsx` chỉ có 1 nơi dùng: `app/(booking)/bookings/page.tsx` — trang Home gộp đăng ký của MỌI tài nguyên (lọc theo tab + `groupFilter` tuỳ chọn), KHÔNG phải trang riêng cho 1 tài nguyên như `booking.base.vn` (ảnh Sếp gửi là trang "Thuê xe ngoài" riêng — HPCORE chưa có route tương đương, việc đó ngoài phạm vi đợt này). Vì vậy 1 cột ngày trong Tuần/Ngày có thể chứa đăng ký của NHIỀU tài nguyên khác nhau, không chỉ 1 như bản tham chiếu.

Plumbing bấm-chọn đã có sẵn và hoạt động tốt, chỉ cần tái dùng: `onDayClick` (Month/Week) và `onAddClick` (Day) đều gọi `setPickerDate(dateStr)` → mở `QuickBookModal` (chọn nhóm → tài nguyên) → `handleResourcePicked` set `quickPrefill = { resourceId, slot: { start, end } }` → `BookingFormDialog` nhận `initialResourceId`/`initialSlot` (dạng chuỗi `YYYY-MM-DDTHH:mm`) và điền sẵn đúng theo `BookingFormDialog.tsx:87-90`. Hiện `slot` luôn bị hard-code `08:00–09:00`. Việc cần làm chỉ là tính `slot` chính xác theo vị trí bấm trong lưới giờ thay vì hard-code, và thêm trục giờ + định vị thẻ theo thời gian thật.

## Goals / Non-Goals

**Goals:**
- Tuần/Ngày hiển thị dạng lưới giờ (trục giờ cố định bên trái, thẻ đăng ký đặt đúng vị trí/chiều cao theo `start_at`/`end_at`).
- Bấm vào ô giờ trống → tính giờ theo toạ độ, làm tròn 30 phút, hiện khung chọn kèm nút "+" rõ ràng → mở đúng luồng `QuickBookModal` → `BookingFormDialog` đã có, với slot chính xác (không còn hard-code 08:00–09:00).
- Đăng ký của nhiều tài nguyên trùng giờ trong cùng 1 ngày hiển thị cạnh nhau, không đè lên nhau, không ẩn bớt.
- Giữ nguyên tô màu theo `resource.color`/trạng thái đang dùng.

**Non-Goals:**
- Không dựng trang riêng cho từng tài nguyên (kiểu `/bookings/[resourceId]`) — đó là khác biệt kiến trúc lớn hơn, ngoài phạm vi đợt này.
- Không đổi 5 quyết định khác của đặc tả lớn (nhãn tab, phạm vi tab "Tất cả", nguồn Quản lý trực tiếp, ACL tài nguyên, gộp nhóm phòng họp).
- Không đổi API `/api/bookings`, không đổi transaction chặn trùng lịch, không đổi field/logic nghiệp vụ của `BookingFormDialog`.
- Không hỗ trợ kéo-giãn (resize) khung đã chọn hoặc kéo-thả đổi giờ đăng ký đã có — chỉ bấm 1 điểm, mặc định 1 tiếng.
- Không bắt buộc hỗ trợ thao tác cảm ứng (kéo chọn trên mobile) ở đợt này — vẫn còn nút "Đặt lịch" chung làm lối vào thay thế.

## Decisions

1. **Trục giờ mặc định 06:00–22:00, tự giãn ra nếu có đăng ký nằm ngoài khoảng đó** (không cắt/giấu dữ liệu thật) — vì view hiện là gộp nhiều tài nguyên nên không thể lấy `bookingWindow` của 1 resource riêng làm biên. Nếu mọi đăng ký trong ngày/tuần đang xem đều nằm trong 06:00–22:00 thì giữ nguyên biên mặc định (gọn, đỡ cuộn).
   - *Alternative đã cân nhắc*: hiện đủ 24h luôn — bị loại vì phần lớn giờ sẽ trống, kéo dài cuộn không cần thiết.

2. **Đăng ký trùng giờ xếp cạnh nhau bằng thuật toán "interval column packing" đơn giản** (sắp theo giờ bắt đầu, gán cột đầu tiên không bị trùng, chiều rộng chia đều theo số cột tối đa của khoảng đang xét) — thuật toán chuẩn kiểu lịch Google Calendar, không cần thư viện ngoài.
   - *Alternative đã cân nhắc*: chỉ hiện đăng ký đầu tiên + "+N khác" như ô tháng — bị loại vì Tuần/Ngày vốn dùng để xem CHI TIẾT hơn Tháng, ẩn bớt sẽ ngược mục đích.

3. **Tái dùng nguyên vẹn luồng `QuickBookModal` → `quickPrefill` → `BookingFormDialog`** đã có, chỉ đổi cách tính `slot` truyền vào (từ hard-code sang tính theo toạ độ bấm) — không tạo luồng mở form mới, không đổi props `BookingFormDialog` nhận (`initialResourceId`/`initialSlot` giữ nguyên kiểu dữ liệu).
   - *Lý do*: giảm rủi ro, không cần sửa `BookingFormDialog.tsx`; đúng tinh thần "chỉ đổi cách hiển thị lịch và cách mở form kèm giờ điền sẵn" trong proposal.

4. **`onDayClick` đổi thành `onSlotClick(dateStr, slot: {start, end})`** cho `WeekCalendar`/`DayCalendar` (báo cáo khảo sát xác nhận 2 component này chỉ được dùng ở `page.tsx`, an toàn đổi signature). `MonthCalendar.onDayClick(dateStr)` giữ nguyên — Tháng không có khái niệm giờ cụ thể để bấm, chỉ chọn ngày, vẫn mở `QuickBookModal` với slot mặc định 08:00–09:00 như hiện tại.
   - `page.tsx`: thêm state `pickerSlot: {start, end} | null`, set qua `onSlotClick`; `handleResourcePicked` ưu tiên `pickerSlot` nếu có, fallback về mặc định 08:00–09:00 khi đến từ Tháng.

5. **Khung chọn (visual) + nút "+" hiện NGAY sau khi bấm, không cần bấm lần 2** — đáp ứng đúng yêu cầu "luôn có nút + rõ ràng" (phương án B) kết hợp với lưới giờ thật (phương án A). Bấm ra ngoài khung hoặc bấm Esc thì ẩn khung chọn.

6. **Mốc làm tròn 30 phút, mặc định khoảng 1 tiếng** — khớp đúng mockup Sếp đã xem và đã duyệt trong demo bản 03.

## Risks / Trade-offs

- [Rủi ro] Thuật toán xếp cột trùng giờ có thể làm thẻ rất hẹp nếu 1 khung giờ có quá nhiều đăng ký khác tài nguyên (hiếm nhưng có thể xảy ra giờ cao điểm) → **Giảm thiểu**: đặt chiều rộng tối thiểu cho mỗi cột (vd 90px), vượt quá thì cho cuộn ngang trong đúng ô ngày đó thay vì ép co nhỏ tới mức không đọc được.
- [Rủi ro] Trục giờ tự giãn khi có đăng ký ngoài 06:00–22:00 có thể làm chiều cao lưới giờ khác nhau giữa các ngày trong cùng tuần (khó so sánh ngang hàng) → **Giảm thiểu**: tính biên giờ chung cho CẢ TUẦN đang xem (không tính riêng từng ngày), đảm bảo 7 cột luôn cùng chiều cao/trục giờ.
- [Trade-off] Không hỗ trợ kéo-giãn chọn khung nhiều giờ liền — chấp nhận được vì mặc định 1 tiếng đã khớp đa số nhu cầu đặt nhanh; người dùng vẫn sửa lại giờ trong `BookingFormDialog` như bình thường.
- [Trade-off] View vẫn là gộp nhiều tài nguyên (không giống hệt bản tham chiếu per-resource) — chấp nhận vì dựng trang riêng từng tài nguyên là thay đổi kiến trúc lớn hơn nhiều, ngoài phạm vi 1 trong 6 quyết định đã duyệt.

## Migration Plan

- Không cần migration dữ liệu — không đổi schema Firestore, không đổi API.
- Thay thế hoàn toàn phần render của `WeekCalendar.tsx`/`DayCalendar.tsx`, giữ nguyên tên file và các export đang dùng (`getWeekStart`, `getWeekRange`, `getDayRange`).
- Build + kiểm tra local trước (`npm run build`, test thủ công các case ở tasks.md), không tự deploy production — chờ Sếp xác nhận sau khi xem trên local/staging.

## Open Questions

- Chưa có — phạm vi đã được Sếp duyệt qua demo (bản 03) và xác nhận hướng kết hợp A+B. Nếu phát sinh thêm trong lúc code (vd thao tác cảm ứng/mobile chưa mượt), sẽ báo lại trước khi tự quyết định mở rộng phạm vi.
