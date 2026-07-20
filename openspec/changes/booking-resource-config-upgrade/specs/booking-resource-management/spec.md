## ADDED Requirements

### Requirement: Quản trị nhóm và tài nguyên đặt lịch
Hệ thống SHALL cho phép admin (`owner`/`admin`) tạo, sửa, bật/tắt (Mở/Đóng) nhóm và tài nguyên đặt lịch. Tắt một nhóm SHALL tự động tắt mọi tài nguyên con đang mở; bật lại nhóm SHALL KHÔNG tự động mở lại tài nguyên con.

#### Scenario: Admin tạo tài nguyên mới
- **WHEN** admin gửi yêu cầu tạo tài nguyên với tên, nhóm, màu sắc hợp lệ
- **THEN** hệ thống tạo tài nguyên mới với trạng thái mặc định "Mở" và loại đăng ký mặc định "Cần duyệt"

#### Scenario: Nhân viên thường không thể tạo/sửa tài nguyên
- **WHEN** một người dùng vai trò `employee` gọi API tạo hoặc sửa tài nguyên
- **THEN** hệ thống từ chối với lỗi 403

#### Scenario: Tắt một nhóm tắt kéo theo tài nguyên con
- **WHEN** admin đóng (tắt) một nhóm đang có tài nguyên con đang mở
- **THEN** mọi tài nguyên con đang mở chuyển sang trạng thái Đóng

### Requirement: Loại đăng ký theo tài nguyên
Mỗi tài nguyên SHALL có thuộc tính `registrationType` là `'auto'` (tự động duyệt) hoặc `'approval'` (cần duyệt theo cây tổ chức). Tài nguyên không có giá trị này (dữ liệu cũ) SHALL được xử lý như `'approval'`.

#### Scenario: Đặt lịch tài nguyên tự động duyệt
- **WHEN** một nhân viên tạo booking cho tài nguyên có `registrationType: 'auto'` và khung giờ không trùng booking khác đang `pending`/`approved`
- **THEN** booking được tạo với trạng thái `approved` ngay lập tức, không tạo bất kỳ approval hay thông báo duyệt nào

#### Scenario: Đặt lịch tài nguyên cần duyệt (mặc định)
- **WHEN** một nhân viên tạo booking cho tài nguyên có `registrationType: 'approval'` hoặc không có field này
- **THEN** booking được tạo với trạng thái `pending`, chuỗi duyệt 2 cấp (quản lý trực tiếp → quản lý nhân sự) được tính và thông báo được gửi như hành vi hiện tại

#### Scenario: Tài nguyên tự động duyệt vẫn bị chặn trùng lịch
- **WHEN** một nhân viên tạo booking cho tài nguyên `'auto'` nhưng khung giờ đã trùng với booking khác đang `pending` hoặc `approved` trên cùng tài nguyên
- **THEN** hệ thống từ chối tạo booking với lỗi báo đã có người đặt, không có ngoại lệ nào bỏ qua việc chặn trùng vì lý do `registrationType`

### Requirement: Tệp đính kèm cấp tài nguyên
Hệ thống SHALL cho phép admin đính kèm tối đa 5 tệp (ảnh/PDF/Word/Excel, tối đa 10MB/tệp) vào một tài nguyên, tách biệt hoàn toàn với tệp đính kèm của từng booking.

#### Scenario: Admin tải tệp đính kèm cho tài nguyên
- **WHEN** admin tải lên 1 tệp PDF 2MB cho một tài nguyên
- **THEN** hệ thống lưu tệp và trả về đường dẫn để hiển thị trong chi tiết tài nguyên, không ảnh hưởng tới danh sách attachments của bất kỳ booking nào

#### Scenario: Từ chối tệp vượt giới hạn
- **WHEN** admin tải lên 1 tệp vượt quá 10MB hoặc quá 5 tệp cho cùng tài nguyên
- **THEN** hệ thống từ chối với thông báo lỗi rõ ràng, không lưu tệp

### Requirement: Bảng quản trị tài nguyên có tìm kiếm và lọc
Trang quản lý tài nguyên SHALL hiển thị danh sách dạng bảng (màu, tên, nhóm, loại đăng ký, quản lý, người theo dõi, trạng thái, thao tác) và SHALL cho phép tìm kiếm theo tên, lọc theo nhóm, trạng thái (Mở/Đóng), và loại đăng ký.

#### Scenario: Lọc theo trạng thái Đóng
- **WHEN** admin chọn bộ lọc trạng thái "Đóng"
- **THEN** bảng chỉ hiển thị các tài nguyên đang có `isActive: false`

#### Scenario: Tìm kiếm theo tên
- **WHEN** admin gõ một từ khoá vào ô tìm kiếm
- **THEN** bảng chỉ hiển thị các tài nguyên có tên chứa từ khoá đó (không phân biệt hoa/thường)
