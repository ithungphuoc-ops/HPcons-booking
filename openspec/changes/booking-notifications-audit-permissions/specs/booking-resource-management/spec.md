## ADDED Requirements

### Requirement: Quản lý tài nguyên (vai trò per-resource) thao tác field vận hành
Người dùng có mặt trong `managerId` của 1 tài nguyên SHALL được phép đóng/mở và sửa các field vận hành (mô tả, tệp đính kèm, người theo dõi) của ĐÚNG tài nguyên đó mà không cần là admin toàn cục. Các field chính sách (loại đăng ký, giới hạn khung giờ, đổi nhóm, đổi quản lý) SHALL vẫn chỉ admin toàn cục mới sửa được.

#### Scenario: Quản lý tài nguyên đóng tài nguyên mình quản lý
- **WHEN** một người dùng vai trò `employee` nhưng là `managerId` của tài nguyên X gửi yêu cầu đóng tài nguyên X
- **THEN** hệ thống cho phép, tài nguyên X chuyển sang Đóng

#### Scenario: Quản lý tài nguyên không thao tác được tài nguyên khác
- **WHEN** người đó gửi yêu cầu đóng tài nguyên Y (không phải `managerId` của họ)
- **THEN** hệ thống từ chối với lỗi 403

#### Scenario: Quản lý tài nguyên không đổi được field chính sách
- **WHEN** quản lý tài nguyên X gửi yêu cầu đổi `registrationType` hoặc `bookingWindow` của tài nguyên X
- **THEN** hệ thống từ chối với lỗi 403 (chỉ admin toàn cục mới đổi được các field này)
