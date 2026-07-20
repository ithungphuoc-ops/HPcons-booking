## ADDED Requirements

### Requirement: Sửa đăng ký đã tạo
Chủ booking (nếu chưa diễn ra) hoặc admin SHALL có thể sửa tiêu đề, thời gian, tài nguyên, mục đích, và dữ liệu biểu mẫu của một đăng ký đã tạo. Sửa giờ hoặc tài nguyên SHALL chạy lại việc chặn trùng lịch, loại trừ chính đăng ký đang sửa.

#### Scenario: Sửa giờ đưa booking đã duyệt về lại chờ duyệt
- **WHEN** chủ booking đổi giờ của 1 booking đang `approved`
- **THEN** booking chuyển về `pending`, chuỗi duyệt được tính lại từ đầu

#### Scenario: Sửa không đụng giờ/tài nguyên không ảnh hưởng trạng thái duyệt
- **WHEN** chủ booking chỉ sửa mô tả, không đổi giờ/tài nguyên
- **THEN** trạng thái duyệt hiện tại (kể cả `approved`) được giữ nguyên

#### Scenario: Sửa giờ gây trùng lịch bị từ chối
- **WHEN** người dùng sửa giờ của 1 booking sang khung giờ đã có booking khác `pending`/`approved` trên cùng tài nguyên
- **THEN** hệ thống từ chối lưu, báo lỗi trùng lịch, giữ nguyên dữ liệu cũ

#### Scenario: Người không liên quan không sửa được
- **WHEN** một người dùng không phải chủ booking và không phải admin cố sửa booking của người khác
- **THEN** hệ thống từ chối với lỗi 403

### Requirement: Xem lịch theo Tuần và Ngày
Người dùng SHALL có thể chuyển đổi giữa 3 chế độ xem lịch: Tháng, Tuần, Ngày.

#### Scenario: Chuyển sang xem Tuần
- **WHEN** người dùng chọn chế độ xem Tuần
- **THEN** hệ thống hiển thị đúng 7 ngày của tuần đang chọn, đầy đủ các booking trong khoảng đó

#### Scenario: Chuyển sang xem Ngày
- **WHEN** người dùng chọn chế độ xem Ngày
- **THEN** hệ thống hiển thị danh sách booking của đúng ngày đó, sắp xếp theo thời gian bắt đầu

### Requirement: Giới hạn khung giờ được phép đặt theo tài nguyên
Mỗi tài nguyên SHALL có thể cấu hình (tuỳ chọn) khung giờ trong ngày và các ngày trong tuần được phép đặt lịch. Tài nguyên không cấu hình SHALL không bị giới hạn gì (mặc định).

#### Scenario: Đặt lịch ngoài khung giờ cho phép bị từ chối
- **WHEN** tài nguyên cấu hình chỉ cho đặt từ 7h30-17h30 và người dùng chọn giờ bắt đầu 19h00
- **THEN** hệ thống từ chối tạo booking, báo rõ khung giờ được phép

#### Scenario: Đặt lịch vào ngày bị chặn bị từ chối
- **WHEN** tài nguyên chặn Chủ Nhật và người dùng chọn ngày Chủ Nhật
- **THEN** hệ thống từ chối tạo booking, báo rõ ngày bị chặn

#### Scenario: Tài nguyên không cấu hình giới hạn — không bị chặn
- **WHEN** tài nguyên không có `bookingWindow`
- **THEN** người dùng đặt lịch giờ nào, ngày nào cũng được (như hành vi hiện tại)

### Requirement: Nhập hàng loạt đăng ký từ Excel
Admin SHALL có thể tải lên 1 tệp Excel (cột Tên tài nguyên, Tiêu đề, Mục đích, Bắt đầu, Kết thúc) để tạo nhiều đăng ký cùng lúc. Hệ thống SHALL báo lỗi rõ ràng cho từng dòng không hợp lệ mà không ảnh hưởng tới các dòng hợp lệ khác.

#### Scenario: Nhập file có cả dòng đúng và dòng sai
- **WHEN** admin tải lên 1 file có 10 dòng, trong đó 2 dòng sai tên tài nguyên
- **THEN** hệ thống tạo thành công 8 đăng ký hợp lệ, báo rõ 2 dòng lỗi kèm số dòng và lý do

#### Scenario: Dòng trùng lịch trong khi nhập bị bỏ qua có lý do rõ
- **WHEN** 1 dòng trong file có giờ trùng với booking đã tồn tại trên cùng tài nguyên
- **THEN** dòng đó bị báo lỗi trùng lịch, không tạo, các dòng khác không bị ảnh hưởng

#### Scenario: Nhân viên thường không thể nhập Excel
- **WHEN** một người dùng vai trò `employee` gọi API nhập Excel
- **THEN** hệ thống từ chối với lỗi 403
