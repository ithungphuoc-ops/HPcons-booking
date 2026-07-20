## Why

Đối chiếu với tài liệu "HP Core Booking – 6 Giai Đoạn" (Giai đoạn 5): thông báo hiện tại chỉ phủ "có đơn cần duyệt" (tạo mới/chuyển cấp/nhắc quá hạn) — người đặt KHÔNG được báo khi đơn được duyệt xong, bị từ chối, bị huỷ, hay sắp tới giờ diễn ra; khi tài nguyên bị đóng cũng không ai được báo dù đang có booking tương lai dùng tài nguyên đó. Nhật ký hoạt động (`logs`) chưa phủ hết các sự kiện quản trị. Mô hình phân quyền 5 cấp của tài liệu (Quản trị toàn hệ thống/Quản trị công ty/Quản lý tài nguyên/Nhân viên/Người theo dõi) chưa được hình thức hoá — "Quản lý tài nguyên" (`managerId` trên tài nguyên) hiện không có quyền thao tác gì hơn nhân viên thường, dù đã có field từ Đợt 1. Đây là Đợt 4/5 của lộ trình nâng cấp Booking đã được Sếp duyệt.

## What Changes

- Thêm thông báo cho người đặt khi: đăng ký được duyệt hoàn tất, bị từ chối (kèm lý do), bị huỷ bởi người khác (admin huỷ hộ), bị sửa bởi người khác (admin sửa hộ).
- Thêm thông báo "sắp tới giờ" (trong vòng 24h) cho người đặt + người theo dõi, qua cron nhắc lại đã có sẵn.
- Thêm thông báo cho quản lý + người theo dõi CỦA TÀI NGUYÊN khi tài nguyên bị đóng mà đang có booking tương lai `pending`/`approved`.
- Mở rộng nhật ký (`BookingLogEntry.action`, chuỗi tự do — không cần đổi type) cho các sự kiện quản trị tài nguyên (đóng/mở, nhập hàng loạt).
- Hình thức hoá vai trò "Quản lý tài nguyên": cho phép người có mặt trong `managerId` của 1 tài nguyên tự đóng/mở VÀ sửa các field vận hành (mô tả, tệp đính kèm, người theo dõi) của ĐÚNG tài nguyên mình quản lý, không cần quyền admin toàn cục. Các field mang tính chính sách (loại đăng ký, giới hạn khung giờ, đổi nhóm/quản lý) vẫn chỉ admin toàn cục mới sửa được.

## Capabilities

### New Capabilities
- `booking-lifecycle-notifications`: Toàn bộ thông báo + nhật ký hoạt động phát sinh trong vòng đời 1 đăng ký (duyệt/từ chối/huỷ/sửa/sắp tới giờ) và vòng đời tài nguyên (đóng/mở ảnh hưởng booking tương lai).
- Thêm yêu cầu mới (ADDED, không phải sửa hành vi cũ) vào spec `booking-resource-management` (đã tạo ở Đợt 1, chưa archive nên chưa có baseline để diff — bổ sung thẳng bằng `## ADDED Requirements`): vai trò "Quản lý tài nguyên" được phép đóng/mở + sửa field vận hành của đúng tài nguyên mình quản lý.

### Modified Capabilities
(không có — phần mở rộng quyền cho "Quản lý tài nguyên" là THÊM một actor mới được phép, không đổi hành vi/quyền admin đã có, nên dùng ADDED thay vì MODIFIED)

## Impact

- `lib/firestore/bookings.ts`: `decideBooking()` thêm thông báo khi duyệt hoàn tất/từ chối; `cancelBooking()`/`updateBookingCore()` thêm thông báo khi hành động do người khác thực hiện; hàm mới `listBookingsStartingSoon()`.
- `app/api/bookings/reminders/route.ts`: gọi thêm bước gửi nhắc "sắp tới giờ".
- `FirestoreBooking` thêm `remindedUpcoming?: boolean` (đánh dấu đã nhắc, tránh nhắc trùng).
- `app/api/booking-resources/[id]/route.ts`: nới quyền cho "Quản lý tài nguyên" (kiểm tra `resource.managerId === session.uid`) bên cạnh `requireAdmin()`, giới hạn field được sửa.
- `app/api/booking-resources/route.ts`: thông báo cho `managerId`/`followerIds` khi đóng tài nguyên có booking tương lai.
- Không ảnh hưởng dữ liệu production hiện có — mọi field mới optional.
