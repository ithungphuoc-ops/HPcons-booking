## ADDED Requirements

### Requirement: Trình thiết kế biểu mẫu theo mục đích
Admin (`owner`/`admin`) SHALL có thể thêm, sửa, xoá, và sắp xếp lại thứ tự các trường tuỳ chỉnh (`formSchema`) của một mục đích đăng ký. Mỗi trường SHALL có nhãn, loại (text/textarea/number/date/select/multiselect/checkbox/file), và cờ bắt buộc.

#### Scenario: Admin thêm trường mới vào mục đích
- **WHEN** admin thêm 1 trường "Tên thiết bị" loại text, bắt buộc, vào mục đích "Mượn thiết bị"
- **THEN** trường được lưu vào `formSchema` của mục đích đó, xuất hiện ngay trong bản xem trước

#### Scenario: Admin sắp xếp lại thứ tự trường bằng kéo-thả
- **WHEN** admin kéo 1 trường từ vị trí thứ 3 lên vị trí thứ 1 trong danh sách trường của 1 mục đích
- **THEN** thứ tự trường được lưu lại đúng theo vị trí mới, áp dụng cho mọi booking tạo sau đó dùng mục đích này

#### Scenario: Nhân viên thường không thể sửa biểu mẫu
- **WHEN** một người dùng vai trò `employee` gọi API cập nhật `formSchema` của 1 mục đích
- **THEN** hệ thống từ chối với lỗi 403

### Requirement: Chọn mục đích và điền biểu mẫu khi tạo đăng ký
Khi tạo đăng ký, người dùng SHALL chọn mục đích từ danh sách đã cấu hình (hoặc chọn "Khác" để nhập tự do). Nếu mục đích được chọn có `formSchema`, hệ thống SHALL hiển thị động các trường tương ứng và yêu cầu điền đủ các trường bắt buộc trước khi lưu.

#### Scenario: Chọn mục đích có biểu mẫu riêng
- **WHEN** người dùng chọn mục đích "Mượn thiết bị" (có 2 trường bắt buộc "Tên thiết bị" và "Số lượng")
- **THEN** 2 trường đó hiển thị ngay trong form tạo đăng ký, và hệ thống từ chối lưu nếu chưa điền đủ

#### Scenario: Danh sách mục đích trống — vẫn nhập tự do được ngay
- **WHEN** công ty chưa cấu hình mục đích nào trong hệ thống
- **THEN** form tạo đăng ký tự động chọn sẵn "Khác" và hiển thị ô nhập tự do, người dùng tạo đăng ký được ngay không bị chặn

#### Scenario: Chọn "Khác" để nhập tự do
- **WHEN** người dùng chọn "Khác" trong danh sách mục đích và gõ mô tả tự do
- **THEN** booking được tạo với mục đích là văn bản tự do đó, không có `formData` nào được yêu cầu

#### Scenario: Server từ chối nếu thiếu trường bắt buộc
- **WHEN** client gửi yêu cầu tạo booking với mục đích có trường bắt buộc nhưng thiếu giá trị trường đó trong `formData`
- **THEN** server từ chối tạo booking với lỗi rõ ràng tên trường còn thiếu, không tin việc validate phía client đã đủ

### Requirement: Hiển thị dữ liệu biểu mẫu đã điền
Chi tiết đăng ký SHALL hiển thị đầy đủ nhãn và giá trị của các trường tuỳ chỉnh đã điền, độc lập với việc `formSchema` hiện tại của mục đích có còn giống lúc tạo booking hay không.

#### Scenario: Xem chi tiết booking có formData
- **WHEN** người dùng mở chi tiết 1 booking đã điền biểu mẫu tuỳ chỉnh
- **THEN** hệ thống hiển thị đúng nhãn và giá trị đã lưu tại thời điểm tạo, kể cả khi admin đã đổi/xoá trường đó khỏi mục đích sau này
