## ADDED Requirements

### Requirement: Thông báo cho người đặt theo vòng đời đăng ký
Người đặt SHALL nhận thông báo khi đăng ký của họ được duyệt hoàn tất, bị từ chối, bị huỷ bởi người khác, hoặc bị sửa bởi người khác.

#### Scenario: Duyệt hoàn tất
- **WHEN** cấp duyệt cuối cùng của 1 đăng ký duyệt xong
- **THEN** người đặt nhận thông báo "Đăng ký của bạn đã được duyệt"

#### Scenario: Bị từ chối
- **WHEN** 1 cấp duyệt từ chối đăng ký
- **THEN** người đặt nhận thông báo bị từ chối kèm lý do (nếu có)

#### Scenario: Bị huỷ bởi admin
- **WHEN** admin huỷ 1 đăng ký không phải của chính mình
- **THEN** người đặt nhận thông báo đăng ký đã bị huỷ

#### Scenario: Tự huỷ không tự thông báo cho chính mình
- **WHEN** người đặt tự huỷ đăng ký của chính mình
- **THEN** không tạo thông báo nào (không cần tự báo cho chính mình)

#### Scenario: Bị sửa bởi admin
- **WHEN** admin sửa 1 đăng ký không phải của chính mình
- **THEN** người đặt nhận thông báo đăng ký đã được sửa

### Requirement: Thông báo sắp tới giờ
Người đặt và người theo dõi của 1 đăng ký đã duyệt SHALL nhận thông báo khi đăng ký sắp diễn ra (trong vòng 24 giờ tới), mỗi đăng ký chỉ nhắc đúng 1 lần.

#### Scenario: Booking sắp diễn ra trong 24h
- **WHEN** cron nhắc lịch chạy và phát hiện 1 booking `approved` bắt đầu trong vòng 24h tới, chưa từng được nhắc
- **THEN** người đặt và mọi người theo dõi nhận thông báo, booking được đánh dấu đã nhắc

#### Scenario: Không nhắc lại
- **WHEN** cron chạy lần tiếp theo và booking đã được đánh dấu đã nhắc
- **THEN** không gửi thông báo "sắp tới giờ" lần nữa cho booking đó

### Requirement: Thông báo khi tài nguyên đóng ảnh hưởng booking tương lai
Khi 1 tài nguyên bị đóng mà đang có booking tương lai `pending` hoặc `approved`, quản lý và người theo dõi CỦA TÀI NGUYÊN đó SHALL nhận thông báo.

#### Scenario: Đóng tài nguyên đang có booking tương lai
- **WHEN** admin hoặc quản lý tài nguyên đóng 1 tài nguyên đang có ít nhất 1 booking tương lai chưa diễn ra
- **THEN** quản lý và người theo dõi của tài nguyên đó nhận thông báo

#### Scenario: Đóng tài nguyên không có booking tương lai
- **WHEN** đóng 1 tài nguyên không có booking tương lai nào
- **THEN** không tạo thông báo nào
