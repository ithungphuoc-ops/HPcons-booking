## Context

`notifyBookingApprover()` (`lib/firestore/bookings.ts`) là hàm DUY NHẤT hiện tại tạo `FirestoreNotification` cho Booking — chỉ gọi khi có đơn cần duyệt (tạo mới/chuyển cấp/nhắc quá hạn qua cron `app/api/bookings/reminders/route.ts`). `decideBooking()`, `cancelBooking()`, `updateBookingCore()` (Đợt 3) chỉ ghi `logs`, không gọi `createNotifications`. Cron nhắc lại chạy 1 lần/ngày (`vercel.json`, `"0 3 * * 1-6"`) — `CRON_SECRET` chưa được set trên Vercel (đã ghi nhận từ trước, ngoài phạm vi đợt này). Role hiện tại (`owner`/`admin`/`manager`/`employee`) dùng CHUNG cho mọi app con (`lib/session.ts`), không thể thêm 1 role mới chỉ cho Booking. `managerId` trên `FirestoreBookingResource` (thêm ở Đợt 1) hiện chỉ để HIỂN THỊ, không cấp quyền gì.

## Goals / Non-Goals

**Goals:**
- Người đặt được báo đầy đủ vòng đời đăng ký của chính mình: duyệt xong, từ chối, bị huỷ/sửa bởi người khác.
- Có thông báo "sắp tới giờ" tận dụng đúng cron đã có (không tạo cron mới).
- Tài nguyên bị đóng có booking tương lai → quản lý + người theo dõi tài nguyên biết ngay.
- "Quản lý tài nguyên" thao tác được phần vận hành của tài nguyên mình quản lý mà KHÔNG cần sửa field `role` toàn cục (tránh phá vỡ mô hình quyền dùng chung mọi app con).

**Non-Goals:**
- Không đổi field `role` toàn cục hay thêm giá trị mới cho `Role` — 5 cấp của tài liệu được MAP vào dữ liệu đã có (xem Decision 3), không phải 1 enum mới.
- Không sửa cơ chế xác thực cron (`CRON_SECRET` chưa set là vấn đề đã biết, ngoài phạm vi đợt này).
- Không làm hệ thống thông báo real-time (push/socket) — vẫn dùng đúng model `FirestoreNotification` + `NotificationBell` polling đã có.

## Decisions

1. **Thêm thông báo trực tiếp tại đúng điểm ghi log tương ứng** (`decideBooking`, `cancelBooking`, `updateBookingCore`), KHÔNG tạo 1 hệ thống event/hook trung gian — nhất quán với cách `notifyBookingApprover` đã được gọi trực tiếp tại `createBooking`/`decideBooking`. Tránh over-engineer (pub/sub) cho quy mô hiện tại.

2. **"Sắp tới giờ" tái dùng ĐÚNG route cron `reminders`** (không tạo cron mới, không sửa `vercel.json`) — thêm 1 bước xử lý riêng trong cùng `GET` handler. Do cron chỉ chạy 1 lần/ngày (3h sáng), "sắp tới giờ" được hiểu là "còn diễn ra trong vòng 24h tới kể từ lúc cron chạy" — đủ ý nghĩa nghiệp vụ (nhắc mỗi sáng những booking sẽ diễn ra trong ngày), không cần cron chạy nhiều lần/giờ.
   - Thêm `remindedUpcoming?: boolean` vào `FirestoreBooking` để KHÔNG nhắc trùng nhiều lần cùng 1 booking qua các lần cron chạy khác ngày (vd booking cách xa ngày tạo, cron chạy nhiều lần trước khi tới hạn 24h — chỉ query khi còn ĐÚNG trong cửa sổ 24h nên rủi ro nhắc trùng chỉ xảy ra nếu cron chạy nhiều lần trong cùng 1 ngày, vốn không xảy ra vì lịch cron cố định 1 lần/ngày; field này chủ yếu để an toàn nếu cron chạy lại thủ công).

3. **Hình thức hoá 5 cấp quyền bằng cách MAP vào dữ liệu đã có, không thêm field/enum mới**:
   - Quản trị toàn hệ thống = `role === 'owner'`
   - Quản trị công ty = `role === 'admin'`
   - Quản lý tài nguyên = `resource.managerId === session.uid` (kiểm tra NGAY TẠI tài nguyên cụ thể, không phải 1 role toàn cục — 1 người có thể là "quản lý tài nguyên" của tài nguyên A nhưng là nhân viên thường ở tài nguyên B)
   - Nhân viên = mọi người dùng còn lại
   - Người theo dõi = có mặt trong `followerIds` (chỉ xem, không có quyền thao tác thêm — vai trò này đã tồn tại ngầm định qua tính năng theo dõi, không cần code thêm)
   - *Alternative đã cân nhắc*: thêm bảng phân quyền riêng (kiểu `app_permissions` của app tổng) — bị loại vì quá phức tạp so với nhu cầu thực tế (chỉ cần 1 field `managerId` đã có sẵn), và Booking đã tách app riêng nên không cần đồng bộ với mô hình quyền app tổng.

4. **"Quản lý tài nguyên" chỉ được sửa field VẬN HÀNH** (mở/đóng `isActive`, `description`, `attachments`, `followerIds`), KHÔNG được sửa field CHÍNH SÁCH (`registrationType`, `bookingWindow`, `managerId`, `groupId`, `approverIds`) — những field này ảnh hưởng tới luồng duyệt/tuân thủ nên vẫn chỉ admin toàn cục mới đổi được. `app/api/booking-resources/[id]/route.ts` (PATCH) kiểm tra: nếu không phải admin, chỉ cho qua nếu `session.uid === resource.managerId` VÀ body chỉ chứa các field vận hành ở trên (từ chối 403 nếu cố sửa field chính sách).

5. **Thông báo đóng tài nguyên chỉ gửi khi ĐANG có booking tương lai `pending`/`approved`** trên tài nguyên đó tại thời điểm đóng — tránh spam thông báo cho tài nguyên đóng mà không ảnh hưởng gì. Query 1 field (`resourceId ==`) + lọc `status`/`startAt` ở code, đúng pattern đã dùng xuyên suốt module.

## Risks / Trade-offs

- [Rủi ro] "Quản lý tài nguyên" tự đóng tài nguyên đang có booking tương lai mà không biết ảnh hưởng gì → **Giảm thiểu**: chính họ cũng nằm trong danh sách nhận thông báo nếu là follower, và UI hiển thị rõ số booking tương lai bị ảnh hưởng trước khi xác nhận đóng (polish thêm ở Đợt 5 nếu cần, không chặn Đợt 4).
- [Rủi ro] Phân quyền theo `managerId` per-resource có thể gây nhầm lẫn nếu 1 người vừa là admin vừa là resource-manager — **Giảm thiểu**: kiểm tra admin trước, resource-manager chỉ là fallback khi KHÔNG phải admin, không xung đột.
- [Trade-off] "Sắp tới giờ" cửa sổ 24h cố định, không cấu hình được theo từng tài nguyên/mục đích — chấp nhận được, đơn giản hoá đúng tinh thần "không over-engineer" của module này.

## Migration Plan

- Không cần script migration — mọi field mới optional.
- Build + test local trước, không tự deploy production.

## Open Questions

- Không có câu hỏi mở chặn triển khai.
