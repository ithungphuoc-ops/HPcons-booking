## Why

Đối chiếu module Booking hiện tại với đặc tả "HP Core Booking – 6 Giai Đoạn" (Base Booking) cho thấy quản lý tài nguyên còn thiếu 2 khả năng cốt lõi: (1) không thể đánh dấu một tài nguyên là "tự động duyệt" — mọi booking, kể cả phòng họp nhỏ ít rủi ro, đều phải đi qua đủ 2 cấp duyệt (quản lý trực tiếp → quản lý nhân sự), gây phiền cho các tài nguyên không cần kiểm soát chặt; (2) tài nguyên không có tệp đính kèm riêng (quy định sử dụng, ảnh, sơ đồ) và màn hình quản trị tài nguyên vẫn ở dạng form-list đơn giản, khó tìm kiếm khi số lượng tài nguyên tăng lên. Đây là Đợt 1/5 trong lộ trình nâng cấp Booking đã được Sếp duyệt.

## What Changes

- Thêm `registrationType: 'auto' | 'approval'` trên mỗi tài nguyên. Tài nguyên `'auto'` bỏ qua toàn bộ chuỗi duyệt 2 cấp (booking tạo ra có `status: 'approved'` ngay) nhưng **vẫn giữ nguyên transaction chặn trùng lịch**. Thiếu field (dữ liệu cũ) = coi như `'approval'`, giữ đúng hành vi hiện tại.
- Thêm `attachments` (danh sách tệp) cấp tài nguyên — độc lập với attachments cấp booking đã có sẵn.
- Đổi `ManageResourcesPanel.tsx` từ form-list sang bảng quản trị: cột màu/tên/nhóm/loại đăng ký/quản lý/người theo dõi/trạng thái/thao tác, kèm tìm kiếm theo tên + lọc theo nhóm/trạng thái/loại đăng ký.
- Đổi nhãn hiển thị trạng thái tài nguyên từ "Bật/Tắt" sang "Mở/Đóng" đúng ngôn ngữ nghiệp vụ trong tài liệu (không đổi field `isActive`, chỉ đổi UI).

## Capabilities

### New Capabilities
- `booking-resource-management`: Quản lý danh mục tài nguyên đặt lịch (nhóm + tài nguyên) — CRUD, loại đăng ký (tự động duyệt/cần duyệt), tệp đính kèm, quản lý/người theo dõi riêng của tài nguyên, tìm kiếm/lọc trong bảng quản trị. Đây là lần đầu khả năng này được ghi thành spec (chưa có spec cũ để mở rộng).

### Modified Capabilities
(không có — chưa có capability nào được ghi spec trước đó trong repo này để sửa)

## Impact

- `lib/firestore/types.ts`: mở rộng `FirestoreBookingResource` (thêm `registrationType?`, `attachments?`).
- `lib/firestore/bookings.ts`: `createBooking` rẽ nhánh theo `registrationType` của tài nguyên.
- `app/api/booking-resources/**`: thêm route upload tệp đính kèm tài nguyên; PATCH nhận thêm `registrationType`.
- `components/booking/ManageResourcesPanel.tsx`: viết lại phần danh sách thành bảng + tìm kiếm/lọc.
- Không ảnh hưởng dữ liệu production hiện có (mọi field mới optional, có fallback an toàn).
