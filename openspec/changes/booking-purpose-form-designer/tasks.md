## 1. Data model

- [x] 1.1 `lib/firestore/types.ts`: thêm `BookingFormFieldType`, `BookingFormField { id, label, type, required, options? }`, mở rộng `FirestoreBookingPurpose.formSchema?: BookingFormField[]`.
- [x] 1.2 `lib/firestore/types.ts`: thêm `FirestoreBooking.formData?: { fieldId, label, type, value }[]` (snapshot, không tra cứu schema hiện tại — xem design.md Decision 4).

## 2. Lưu trữ + API mục đích

- [x] 2.1 `lib/firestore/bookingPurposes.ts`: thêm `getBookingPurposeById(id)` và `updateBookingPurposeFormSchema(id, formSchema)`.
- [x] 2.2 `toBookingPurposeJson()`: thêm `form_schema` vào JSON trả về.
- [x] 2.3 `app/api/booking-purposes/[id]/route.ts` (PATCH): nhận thêm nhánh `body.form_schema` (mảng, có validate loại/nhãn) → gọi `updateBookingPurposeFormSchema`, chỉ admin (đã có `requireAdmin`).

## 3. Trình thiết kế biểu mẫu (UI)

- [x] 3.1 `app/(booking)/bookings/purposes/page.tsx`: thêm nút "Thiết kế biểu mẫu" (icon `LayoutGrid`) trên mỗi `PurposeRow`, toggle hiện/ẩn editor bên dưới dòng đó; badge "N trường" khi mục đích đã có formSchema.
- [x] 3.2 `components/booking/PurposeFormDesigner.tsx` (mới): thêm/xoá trường (nhãn, loại trong 8 loại, bắt buộc, danh sách lựa chọn cho select/multiselect), kéo-thả sắp xếp lại bằng HTML5 `draggable`, nút "Lưu biểu mẫu" gọi PATCH ở 2.3.
- [x] 3.3 Xem trước (preview) tái dùng component dùng chung `components/booking/BookingDynamicFields.tsx` (không tải file thật ở chế độ preview).

## 4. Chọn mục đích + form động khi tạo đăng ký

- [x] 4.1 `app/(booking)/bookings/page.tsx`: fetch `GET /api/booking-purposes` trong `load()`, thêm state `purposes`, truyền xuống `BookingFormDialog` như prop mới.
- [x] 4.2 `components/booking/BookingFormDialog.tsx`: thêm prop `purposes`; đổi mục đích từ input tự do thành `<select>` (mục đích thật + "Khác (nhập tự do)" luôn ở cuối); mặc định chọn "Khác" nếu `purposes` rỗng; render `BookingDynamicFields` khi mục đích có `form_schema`, validate required trước khi submit (bao gồm trường `file` qua upload riêng `handleDynamicFileUpload` tái dùng route `/api/bookings/attachments`).
- [x] 4.3 `submit()`: gửi `purpose_id` (mục đích thật) HOẶC `purpose_text` (Khác), kèm `form_data` snapshot.

## 5. Validate + lưu ở server

- [x] 5.1 `app/api/bookings/route.ts` (POST): khi có `purpose_id`, load qua `getBookingPurposeById`, validate mọi trường `required` trong `formSchema` có giá trị non-empty — trả lỗi 400 rõ tên trường thiếu nếu không đủ.
- [x] 5.2 Build snapshot `formData` (kèm `label`/`type` tại thời điểm tạo) truyền vào `createBooking()`; `toBookingJson()` trả thêm `form_data`.

## 6. Hiển thị chi tiết

- [x] 6.1 `components/booking/BookingDetailDialog.tsx`: hiển thị `form_data` (nhãn: giá trị, kể cả mảng/boolean/tệp) trong section "MỤC ĐÍCH" đã có.

## 7. Kiểm thử

- [x] 7.1 `npm run build` sạch.
- [x] 7.2 Smoke test dev server (không login): `/bookings/purposes` → 307, `GET /api/booking-purposes` → 401, `POST /api/bookings` → 401 — không route nào 500, log dev server sạch.
- [ ] 7.3 Test thủ công VỚI TÀI KHOẢN THẬT (cần Sếp/trình duyệt thật): thiết kế 1 mục đích có 2 trường bắt buộc, tạo booking chọn mục đích đó — xác nhận bị chặn nếu thiếu, tạo thành công khi đủ, xem lại chi tiết thấy đúng dữ liệu đã điền.
- [ ] 7.4 Test thủ công: chọn "Khác", nhập tự do — xác nhận vẫn tạo được bình thường như trước khi có thay đổi này.
- [ ] 7.5 Test thủ công: xoá 1 trường khỏi mục đích sau khi đã có booking dùng trường đó — xác nhận booking cũ vẫn hiển thị đúng dữ liệu đã điền.
