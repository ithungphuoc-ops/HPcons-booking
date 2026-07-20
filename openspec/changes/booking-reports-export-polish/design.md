## Context

`app/(booking)/bookings/reports/page.tsx` hiện fetch `/api/bookings` không truyền `from`/`to` (dùng mặc định 30 ngày của API) + `/api/booking-resources`, lọc CLIENT-SIDE chỉ theo `groupFilter`. `GET /api/bookings` đã hỗ trợ `from`/`to`/`resource_id`/`status` nhưng chưa hỗ trợ lọc theo `user_id`. `/api/members` đã trả sẵn `department` (tên phòng ban) cho mỗi user — đủ để suy ra phòng ban của người đặt phía client mà không cần API mới. `xlsx` đã có sẵn trong `package.json` từ Đợt 3, hiện CHỈ dùng server-side (route nhập Excel) — giữ đúng nguyên tắc không đưa vào bundle client.

## Goals / Non-Goals

**Goals:**
- Bộ lọc báo cáo đầy đủ theo tài liệu, hoạt động trên đúng tập dữ liệu đang hiển thị.
- Xuất Excel đúng tập dữ liệu đã lọc, xử lý hoàn toàn server-side.
- Không đổi hành vi mặc định (vẫn 30 ngày gần nhất nếu không đổi bộ lọc) — tránh bất ngờ cho người dùng quen giao diện cũ.

**Non-Goals:**
- Không làm export định kỳ tự động (gửi email báo cáo) — chỉ xuất theo yêu cầu (on-demand).
- Không đổi cấu trúc dữ liệu Booking — chỉ đọc, không ghi.

## Decisions

1. **Filter theo phòng ban thực hiện HOÀN TOÀN client-side**, dựa vào `department` đã có sẵn trong response `/api/members` (không cần API/field Firestore mới). Join `booking.user_id` → `member.department` trong bộ nhớ, vì số lượng booking trong khoảng báo cáo (30-90 ngày) đủ nhỏ để lọc client-side, tránh thêm 1 query Firestore mới (đúng nguyên tắc hạn chế truy vấn mới của module này).

2. **Route xuất Excel MỚI (`/api/bookings/export`), KHÔNG tái dùng `/api/bookings`** — vì cần trả về file nhị phân (`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) thay vì JSON. Route nhận CÙNG bộ tham số lọc (`from`, `to`, `group_id`, `resource_id`, `status`, `user_id`) qua query string giống hệt trang báo cáo đang dùng, dùng `XLSX.utils.json_to_sheet` + `XLSX.write({type:'buffer'})` build file, trả về qua `NextResponse` với header `Content-Disposition: attachment`.
   - *Alternative đã cân nhắc*: xuất CSV thay vì Excel (đơn giản hơn, không cần thư viện) — bị loại vì tài liệu yêu cầu cụ thể "xuất Excel", và `xlsx` đã có sẵn từ Đợt 3 nên không tốn thêm dependency.

3. **Lọc phòng ban ở route export dùng LẠI đúng data client đã lọc** — route export nhận `user_ids` (danh sách id, đã lọc theo phòng ban ở client) thay vì tự tính lại phòng ban ở server, tránh trùng lặp logic join phòng ban ở cả 2 nơi. Nếu không có `user_ids` (không lọc theo phòng ban) thì bỏ qua tham số này.

## Risks / Trade-offs

- [Rủi ro] Nếu số lượng booking trong khoảng ngày rất lớn (nhiều nghìn), lọc phòng ban client-side có thể chậm → chấp nhận được ở quy mô hiện tại (công ty vừa/nhỏ), có thể chuyển sang server-side lọc phòng ban sau nếu cần.
- [Trade-off] Route export dùng lại filter đã tính ở client (`user_ids`) thay vì tự trích xuất theo phòng ban ở server — nếu sau này có API khác cần xuất theo phòng ban độc lập với trang báo cáo, sẽ cần viết lại logic riêng; chấp nhận được vì hiện chỉ có 1 nơi gọi route này.

## Migration Plan

- Không cần migration — chỉ thêm route đọc + UI lọc, không đổi dữ liệu.
- Build + test local trước, không tự deploy production.

## Open Questions

- Không có câu hỏi mở chặn triển khai.
