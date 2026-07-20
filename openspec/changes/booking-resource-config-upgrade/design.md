## Context

Booking hiện có `FirestoreBookingResource` với field `approverIds` không còn được đọc (duyệt nay hoàn toàn theo cây tổ chức người đặt), `managerId`/`followerIds` riêng của tài nguyên đã có. `createBooking()` (`lib/firestore/bookings.ts`) luôn tính chuỗi duyệt 2 cấp (quản lý trực tiếp → quản lý nhân sự) trong 1 Firestore transaction cũng đảm nhiệm việc chặn trùng lịch. `ManageResourcesPanel.tsx` hiện là danh sách dạng form (356 dòng), CRUD qua `app/api/booking-resources/route.ts` + `[id]/route.ts` (yêu cầu `requireAdmin`). Đã có route mẫu upload tệp `app/api/bookings/attachments/route.ts` (FormData → Firebase Storage, giới hạn 10MB/tệp, 5 tệp) để tái dùng logic.

## Goals / Non-Goals

**Goals:**
- Cho phép admin đánh dấu 1 tài nguyên là tự động duyệt, bỏ qua hoàn toàn bước tính approvals/gửi thông báo duyệt, nhưng KHÔNG được bỏ qua chặn trùng lịch.
- Thêm tệp đính kèm cấp tài nguyên, tách biệt hoàn toàn với tệp đính kèm cấp booking.
- Nâng cấp UI quản trị tài nguyên thành bảng có tìm kiếm/lọc, không đổi hành vi API đã có (chỉ thêm field mới).
- An toàn tuyệt đối với dữ liệu production đang chạy — không có bước migration nào chạy tay.

**Non-Goals:**
- Không đổi luồng duyệt 2 cấp hiện tại cho tài nguyên `'approval'` (giữ nguyên `getDirectManagerId`/`getHrDepartmentLeaderId`).
- Không làm giới hạn khung giờ đăng ký, không làm trình thiết kế biểu mẫu (thuộc Đợt 2, 3 sau).
- Không đổi field `isActive` hay logic bật/tắt tài nguyên hiện có — chỉ đổi nhãn hiển thị.

## Decisions

1. **`registrationType?: 'auto' | 'approval'` là optional, không bắt buộc.** Lý do: dữ liệu tài nguyên production hiện có không có field này; nếu bắt buộc sẽ cần migration/backfill. Đọc field này ở `createBooking` với fallback rõ ràng: `resource.registrationType === 'auto' ? 'auto' : 'approval'` — tức bất kỳ giá trị nào khác `'auto'` (kể cả thiếu field) đều xử lý như hiện tại. Đây là cách đã dùng nhất quán trong module này khi thêm field mới vào dữ liệu cũ (vd `managerId`/`followerIds` trước đó).

2. **Tài nguyên `'auto'` vẫn chạy transaction chặn trùng lịch y hệt, chỉ bỏ nhánh tính `approvals`/gọi `notifyBookingApprover`.** Không tách thành 2 hàm `createBooking` riêng — chỉ thêm 1 `if` rẽ nhánh ngay tại điểm tính `approvals` hiện có (dòng ~132-193 của `bookings.ts`), giữ transaction dùng chung để không phải duy trì 2 bản logic chặn trùng song song (rủi ro lệch nhau khi sửa sau này).

3. **Tệp đính kèm tài nguyên dùng route + shape dữ liệu giống hệt tệp đính kèm booking** (`{name, url}[]`, cùng giới hạn 10MB/5 tệp, cùng thư mục Storage gốc nhưng path riêng `booking-resources/{resourceId}/...` để không lẫn với `bookings/{bookingId}/...`). Lý do: tái dùng toàn bộ validate/logic đã kiểm chứng ở `app/api/bookings/attachments/route.ts`, giảm rủi ro thay vì viết logic upload mới.

4. **Bảng quản trị tài nguyên lọc/tìm kiếm hoàn toàn phía client** (dữ liệu đã tải hết 1 lần qua `GET /api/booking-resources`, số lượng tài nguyên nhỏ — không cần lọc phía server/Firestore). Tránh lặp lại rủi ro composite-index đã gặp 3 lần trong module này vì không cần thêm truy vấn Firestore mới nào cho việc này.

5. **Đổi nhãn "Mở/Đóng" chỉ ở tầng hiển thị (UI string), giữ nguyên field `isActive: boolean` và mọi API liên quan.** Tránh đổi tên field kéo theo phải sửa mọi nơi đọc `isActive` (bao gồm cả logic tự động tắt tài nguyên con khi tắt nhóm).

## Risks / Trade-offs

- [Rủi ro] Admin đánh dấu nhầm 1 tài nguyên quan trọng (vd phòng họp lớn, xe công ty) là `'auto'`, dẫn tới booking được duyệt ngay không ai kiểm soát → **Giảm thiểu**: mặc định khi tạo tài nguyên mới vẫn là `'approval'` (không mặc định `'auto'`), UI hiển thị rõ badge "Tự động duyệt" màu cảnh báo trong bảng để admin nhận ra ngay.
- [Rủi ro] Thêm route upload mới cho tài nguyên có thể lặp lỗi kiểm tra quyền nếu copy-paste thiếu sót → **Giảm thiểu**: bắt buộc dùng `requireAdmin()` giống hệt các route quản trị tài nguyên khác, viết test thủ công gọi thử bằng tài khoản `employee` để xác nhận bị chặn 403 trước khi coi Đợt 1 hoàn tất.
- [Trade-off] Lọc/tìm kiếm bảng hoàn toàn client-side sẽ chậm dần nếu số tài nguyên tăng lên hàng nghìn — chấp nhận được ở quy mô hiện tại (vài chục tài nguyên), sẽ cân nhắc lại nếu công ty mở rộng nhiều.

## Migration Plan

- Không cần script migration — mọi field mới optional, đọc có fallback an toàn cho document cũ.
- Deploy theo đúng nề nếp đã thống nhất: chỉ build + test local trước, KHÔNG tự ý deploy production — hỏi Sếp trước khi push lên `booking.hpcore.vn`.
- Rollback (nếu cần): revert commit — vì không có migration dữ liệu, việc rollback code an toàn tuyệt đối, dữ liệu cũ không bị ảnh hưởng bởi field mới chưa từng ghi.

## Open Questions

- Không có câu hỏi mở nào chặn việc triển khai Đợt 1 — các quyết định về "loại đăng ký" và phạm vi đã được Sếp xác nhận trước khi bắt đầu.
