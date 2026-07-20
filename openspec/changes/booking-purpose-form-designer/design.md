## Context

`BookingFormDialog.tsx` hiện không nhận prop `purposes` — mục đích là ô nhập tự do `purposeText` hoàn toàn độc lập với collection `bookingPurposes`. Trang `/bookings/purposes` (`app/(booking)/bookings/purposes/page.tsx`) chỉ là CRUD tên mục đích (thêm/sửa tên/bật-tắt), gọi `GET/POST /api/booking-purposes` + `PATCH /api/booking-purposes/[id]`. `lib/firestore/bookingPurposes.ts` chưa có hàm lấy 1 mục đích theo id hay cập nhật form schema. `toBookingJson()` (`lib/firestore/bookings.ts` dòng 388-415) ưu tiên hiển thị `purposeText` nếu có, fallback tra `purposeMap` theo `purposeId`. Booking creation route `app/api/bookings/route.ts` (POST) nhận `purpose_id`/`purpose_text` riêng biệt, không có khái niệm form động.

## Goals / Non-Goals

**Goals:**
- Mỗi mục đích (`FirestoreBookingPurpose`) có thể có `formSchema` (danh sách trường tuỳ chỉnh, có thứ tự) do admin thiết kế qua kéo-thả.
- `BookingFormDialog` chọn mục đích từ danh sách thật, hiện form động tương ứng, validate bắt buộc 2 lớp (client + server).
- Nếu công ty CHƯA cấu hình mục đích nào (trường hợp đã xảy ra thực tế tuần trước), người dùng vẫn nhập tự do được ngay — không quay lại tình trạng bị kẹt.
- Dữ liệu booking cũ (không có `purposeId`/`formData`) vẫn hiển thị đúng, không vỡ.

**Non-Goals:**
- Không giới hạn khung giờ đăng ký theo mục đích (thuộc Đợt 3).
- Không hỗ trợ logic điều kiện phức tạp giữa các trường (hiện trường nào tuỳ theo giá trị trường khác) — chỉ danh sách trường tuyến tính.
- Trường loại `file` chỉ nhận 1 tệp/trường (không phải nhiều tệp), tái dùng nguyên route upload đã có của booking.

## Decisions

1. **Thêm pseudo-option `"__other__"` vào đầu/cuối `<select>` mục đích trong `BookingFormDialog`, KHÔNG lưu giá trị này xuống server.** Khi chọn `"__other__"`, hiện lại đúng ô nhập tự do `purposeText` như hiện tại (giữ nguyên UX cho trường hợp công ty chưa cấu hình mục đích nào — đúng lý do Sếp yêu cầu đổi sang free-text tuần trước). Nếu danh sách `bookingPurposes` rỗng, mặc định chọn sẵn `"__other__"` để không có màn hình "trống rỗng không biết bấm gì".
   - *Alternative đã cân nhắc*: bắt buộc luôn phải có ít nhất 1 mục đích thật — bị loại vì lặp lại đúng vấn đề đã xảy ra (company chưa kịp cấu hình → nhân viên không đặt lịch được).

2. **`BookingFormField` là 1 kiểu phẳng dùng chung cho mọi loại trường**, không có logic điều kiện:
   ```ts
   type BookingFormFieldType = 'text'|'textarea'|'number'|'date'|'select'|'multiselect'|'checkbox'|'file'
   interface BookingFormField { id: string; label: string; type: BookingFormFieldType; required: boolean; options?: string[] }
   ```
   `id` sinh bằng `crypto.randomUUID()` phía client lúc thêm trường (không cần chờ server) — dùng làm key ổn định cho kéo-thả và làm khoá trong `formData`.

3. **Kéo-thả sắp xếp thứ tự trường dùng HTML5 `draggable` gốc** (`onDragStart`/`onDragOver`/`onDrop` đổi chỗ 2 phần tử trong mảng `formSchema` tại state React), KHÔNG thêm thư viện `dnd-kit`/`react-beautiful-dnd`. Lý do: `package.json` hiện không có sẵn thư viện kéo-thả nào, thêm mới sẽ tăng bundle không cần thiết cho 1 thao tác đơn giản (đổi chỗ phần tử mảng).

4. **`formData` trên `FirestoreBooking` là MẢNH SNAPSHOT, không phải map tra cứu theo schema hiện tại**: `{ fieldId: string; label: string; type: BookingFormFieldType; value: string | number | boolean | string[] | { name: string; url: string } | null }[]`. Lưu kèm `label`/`type` ngay lúc tạo booking (không chỉ lưu `fieldId` rồi tra `formSchema` mới nhất) — vì admin có thể sửa/xoá trường sau này, nhưng chi tiết booking cũ vẫn phải hiển thị đúng nhãn đã điền tại thời điểm đó (xem spec Requirement "Hiển thị dữ liệu biểu mẫu đã điền"). Validate required ở CẢ client (trước khi submit) lẫn server (route POST, dùng `formSchema` của đúng `purposeId` đã chọn tại thời điểm tạo — không tin dữ liệu client gửi lên là đã validate đúng).

5. **Trường loại `file` tái dùng nguyên `app/api/bookings/attachments/route.ts`** (đã có, giới hạn 10MB/tệp) — không tạo route upload riêng cho form field. Giá trị lưu trong `formData[field.id]` là `{name, url}` giống hệt shape attachments thường.

6. **Trình thiết kế biểu mẫu nằm ngay trong `/bookings/purposes`**, mở rộng `PurposeRow` hiện có bằng 1 nút "Thiết kế biểu mẫu" toggle hiện/ẩn 1 khối editor bên dưới đúng dòng mục đích đó (không tạo trang riêng) — giữ nguyên cấu trúc trang đã quen thuộc, chỉ thêm khả năng mới.

7. **`lib/firestore/bookingPurposes.ts` thêm `getBookingPurposeById(id)` và `updateBookingPurposeFormSchema(id, formSchema)`** — dùng ở cả UI designer (lưu schema) lẫn route POST booking (validate required phía server).

## Risks / Trade-offs

- [Rủi ro] Đổi mục đích từ free-text về select có thể khiến người dùng bối rối nếu không để ý lựa chọn "Khác" → **Giảm thiểu**: đặt "Khác (nhập tự do)" là lựa chọn cuối cùng luôn hiển thị rõ trong select, tự động chọn sẵn nếu danh sách mục đích rỗng.
- [Rủi ro] Admin xoá/đổi loại 1 trường đang có booking cũ đã điền dữ liệu theo schema cũ → dữ liệu cũ trong `formData` không khớp schema mới → **Giảm thiểu**: `BookingDetailDialog` hiển thị `formData` độc lập với schema hiện tại (chỉ hiển thị key/value đã lưu, không tra cứu lại schema mới nhất), tránh vỡ hiển thị dữ liệu lịch sử.
- [Trade-off] Không hỗ trợ logic điều kiện giữa các trường — chấp nhận được ở quy mô hiện tại, có thể bổ sung sau nếu cần.

## Migration Plan

- Không cần script migration — `formSchema`/`formData` đều optional, purpose cũ không có `formSchema` = mảng rỗng (không hiện trường nào thêm).
- Build + test local trước, không tự deploy production.

## Open Questions

- Không có câu hỏi mở chặn triển khai — phạm vi đã được Sếp xác nhận làm đúng theo tài liệu.
