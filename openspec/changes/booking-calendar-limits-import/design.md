## Context

`app/api/bookings/[id]/route.ts` hiện chỉ có `PATCH` cho `action: 'approve'|'reject'` và `DELETE` để huỷ — không có sửa field cốt lõi. `MonthCalendar.tsx` chỉ vẽ lưới tháng, `getMonthGridRange()` được `bookings/page.tsx` dùng để tải đúng khoảng ngày hiển thị qua `listBookingsInRange`. `createBooking()` (`lib/firestore/bookings.ts`) đã có transaction chặn trùng lịch chỉ lọc `resourceId ==` trên Firestore, phần còn lại lọc code — pattern bắt buộc lặp lại cho bất kỳ truy vấn Firestore mới nào trong đợt này. `package.json` hiện không có thư viện đọc Excel nào.

## Goals / Non-Goals

**Goals:**
- Sửa đăng ký chạy lại đúng transaction chặn trùng lịch, loại trừ chính booking đang sửa.
- Thêm view Tuần/Ngày tái dùng data-fetching hiện có (`listBookingsInRange`), không đổi API `/api/bookings`.
- Giới hạn khung giờ là tuỳ chọn per-resource, mặc định KHÔNG áp dụng (theo xác nhận của Sếp) — không phá bất kỳ tài nguyên nào đang hoạt động bình thường.
- Nhập Excel báo lỗi RÕ TỪNG DÒNG, dòng đúng vẫn tạo được (không rollback toàn bộ vì 1 dòng lỗi).

**Non-Goals:**
- Không hỗ trợ sửa xuyên approval đã duyệt xong (sửa 1 booking `approved` sẽ đưa lại về trạng thái cần duyệt lại — xem Decision 2).
- Không hỗ trợ import từ định dạng khác ngoài `.xlsx`/`.xls` (không làm CSV riêng, `xlsx` đọc được cả 2).
- Không làm lịch dạng lưới giờ chi tiết (time-grid theo từng 15/30 phút) cho Tuần/Ngày — chỉ liệt kê danh sách theo thứ tự thời gian trong mỗi ô ngày, đủ dùng, tránh over-engineer.

## Decisions

1. **`updateBookingCore()` là hàm MỚI, tách biệt hoàn toàn khỏi `decideBooking()`** (không tái dùng chung 1 hàm cho cả sửa lẫn duyệt) — vì 2 luồng có bất biến khác nhau (sửa đổi field cốt lõi + chạy lại conflict-guard; duyệt chỉ đổi `approvals`/`status`). Transaction chặn trùng của `updateBookingCore` copy logic từ `createBooking` nhưng thêm điều kiện loại trừ `docId !== id` đang sửa.

2. **Sửa 1 booking đã `approved` sẽ đưa trạng thái về lại `pending` và TÍNH LẠI approvals từ đầu** (không giữ trạng thái đã duyệt cũ) — vì thời gian/tài nguyên đổi có thể khiến quyết định duyệt trước đó không còn hợp lệ (vd tài nguyên đổi từ phòng nhỏ sang phòng lớn, hoặc giờ đổi sang khung giờ khác). Booking `pending` sửa xong vẫn giữ `pending`, chỉ tính lại approvals nếu resource đổi (đổi tài nguyên có thể đổi registrationType auto/approval).
   - *Alternative đã cân nhắc*: giữ nguyên trạng thái đã duyệt khi sửa giờ/tài nguyên — bị loại vì tạo lỗ hổng (sửa giờ sau khi đã duyệt để né việc phải duyệt lại).

3. **Chỉ chủ booking (chưa diễn ra, giống điều kiện huỷ hiện tại) hoặc admin được sửa.** Tái dùng đúng điều kiện `DELETE` đã có (`app/api/bookings/[id]/route.ts` dòng 74-79: chưa diễn ra + là chủ hoặc admin).

4. **View Tuần/Ngày là 2 component MỚI (`WeekCalendar.tsx`, `DayCalendar.tsx`), không sửa `MonthCalendar.tsx`** — toggle ở `bookings/page.tsx` chọn component nào render theo `viewMode: 'month'|'week'|'day'`. Cả 3 dùng chung shape `CalendarBooking` đã có. Tránh nhồi nhét 3 chế độ vào 1 component phức tạp hoá logic lưới ngày hiện tại.

5. **`bookingWindow` trên tài nguyên**: `{ startHour: number; endHour: number; blockedWeekdays?: number[] }` (giờ dạng số 0-24, `blockedWeekdays` dùng đúng convention `Date.getDay()` — 0=Chủ Nhật...6=Thứ Bảy). Thiếu field = không giới hạn (đúng quyết định của Sếp). Validate ở CẢ `createBooking` và `updateBookingCore` — kiểm tra giờ bắt đầu/kết thúc nằm trong `[startHour, endHour]` và ngày trong tuần không thuộc `blockedWeekdays`, báo lỗi rõ ràng nếu vi phạm (400, không phải 409 — đây không phải lỗi trùng lịch).

6. **Nhập Excel dùng thư viện `xlsx` (SheetJS), xử lý HOÀN TOÀN ở server** (route nhận file qua FormData, parse bằng `XLSX.read(buffer)`), KHÔNG parse ở client — tránh phải cài `xlsx` vào bundle client (giữ nhẹ, đúng tinh thần "nhẹ app" xuyên suốt việc tách Booking). Mỗi dòng xử lý ĐỘC LẬP (không dùng 1 transaction bao toàn bộ file) — dòng nào lỗi (tên tài nguyên không khớp, ngày giờ sai định dạng, trùng lịch) bị bỏ qua và ghi vào mảng lỗi kèm số dòng, các dòng đúng vẫn tạo bình thường qua `createBooking()` sẵn có (tái dùng nguyên transaction chặn trùng, không viết lại).
   - *Alternative đã cân nhắc*: bọc cả file trong 1 transaction, rollback toàn bộ nếu có dòng lỗi — bị loại vì 1 lỗi gõ sai tên tài nguyên ở dòng 50/100 sẽ làm mất công tạo lại từ đầu, trải nghiệm tệ hơn nhiều so với báo lỗi từng dòng.
   - Khớp tên tài nguyên: so khớp chính xác (không phân biệt hoa/thường, trim khoảng trắng) với tên tài nguyên đang tồn tại — không dùng fuzzy-match để tránh gán nhầm tài nguyên.
   - Định dạng ngày giờ chấp nhận: `dd/mm/yyyy hh:mm` (đúng theo xác nhận của Sếp).

## Risks / Trade-offs

- [Rủi ro] Sửa 1 booking đưa về `pending` có thể gây khó chịu nếu người dùng chỉ sửa mô tả nhỏ không liên quan giờ/tài nguyên → **Giảm thiểu**: chỉ tính lại approvals/đưa về pending nếu `startAt`/`endAt`/`resourceId` thực sự thay đổi so với bản gốc; sửa tiêu đề/mục đích/formData đơn thuần KHÔNG đụng tới `status`/`approvals`.
- [Rủi ro] Import Excel sai cột có thể tạo hàng loạt booking rác → **Giảm thiểu**: chỉ admin dùng được, xem trước tổng số dòng hợp lệ/lỗi TRƯỚC khi xác nhận tạo (2 bước: đọc file trả về preview, xác nhận mới thực sự tạo).
- [Trade-off] View Tuần/Ngày chỉ liệt kê danh sách (không phải lưới giờ trực quan) — chấp nhận được, đủ dùng để xem chi tiết hơn Tháng, có thể nâng cấp UI sau nếu cần.

## Migration Plan

- Không cần script migration — mọi field mới optional.
- `npm install xlsx` — chỉ thêm dependency server-side dùng trong route API, không import vào bất kỳ Client Component nào.
- Build + test local trước, không tự deploy production.

## Open Questions

- Không có câu hỏi mở chặn triển khai — phạm vi giới hạn giờ và mẫu Excel đã được Sếp xác nhận trước khi bắt đầu.
