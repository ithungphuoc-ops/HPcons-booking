## 1. API

- [x] 1.1 `app/api/bookings/route.ts` (GET): thêm hỗ trợ lọc `user_id`.
- [x] 1.2 Route mới `app/api/bookings/export/route.ts`: build workbook bằng `XLSX.utils.json_to_sheet` + `XLSX.write({type:'buffer'})`, trả về file `.xlsx` tải trực tiếp — xác nhận qua build: vẫn 171B (không lọt `xlsx` vào bundle client).

## 2. UI báo cáo

- [x] 2.1 `app/(booking)/bookings/reports/page.tsx`: thêm bộ lọc khoảng ngày (mặc định 30 ngày gần nhất), tài nguyên cụ thể, người đặt, trạng thái, phòng ban.
- [x] 2.2 Lọc phòng ban client-side (join `booking.user_id` → `member.department` từ `/api/members`); các lọc còn lại (ngày/tài nguyên/người đặt/trạng thái) truyền qua query string cho `GET /api/bookings`.
- [x] 2.3 Nút "Xuất Excel" gọi `GET /api/bookings/export` với đúng bộ tham số đang áp dụng (kèm `user_ids` đã lọc theo phòng ban nếu có).

## 3. Rà lại 4 đợt trước

- [x] 3.1 Đọc lại code đã sửa ở Đợt 1-4 trong lúc triển khai Đợt 5 (tái sử dụng `createBooking`, `updateBookingCore`, `buildValidatedFormData`, `parseBookingWindow` xuyên suốt) — không phát hiện lỗi rõ ràng nào còn sót.
- [x] 3.2 `npm run build` sạch xuyên suốt — chạy sau mỗi đợt (5 lần), lần cuối cùng gộp cả 5 đợt vẫn sạch, 23 route, không lỗi TypeScript.

## 4. Kiểm thử

- [x] 4.1 `npm run build` sạch.
- [x] 4.2 Smoke test dev server toàn bộ route đã đổi trong cả 5 đợt (không login): `/bookings`, `/bookings/purposes`, `/bookings/reports` → 307; `/api/bookings`, `/api/booking-resources`, `/api/booking-purposes`, `/api/bookings/export` → 401; `/api/bookings/import` (GET, route chỉ có POST) → 405 — không route nào 500, log sạch.
- [ ] 4.3 Test thủ công VỚI TÀI KHOẢN THẬT (cần Sếp/trình duyệt thật): áp dụng từng bộ lọc báo cáo, xác nhận số liệu đúng; xuất Excel, mở file xác nhận đúng dữ liệu đã lọc.
