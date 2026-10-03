## ADDED Requirements

### Requirement: Xác định Quản lý trực tiếp theo hợp đồng dữ liệu chung
Hệ thống SHALL xác định Quản lý trực tiếp của một người theo thứ tự: phần tử đầu tiên trong `directManagerIds` khác chính họ và còn tồn tại; nếu không có thì trưởng đơn vị chính khác chính họ; nếu không có thì đi lên trưởng nhóm cha theo `parentId` (tối đa 10 bước); nếu không có thì không có quản lý trực tiếp.

#### Scenario: Có directManagerIds
- **WHEN** người đặt có `directManagerIds = [m1, m2]`
- **THEN** người duyệt cấp 1 là m1

#### Scenario: Phần tử đầu là chính mình
- **WHEN** người đặt có `directManagerIds = [chính mình, m2]`
- **THEN** người duyệt cấp 1 là m2

#### Scenario: Đơn vị không có trưởng
- **WHEN** người đặt không có `directManagerIds` và đơn vị chính chưa có trưởng nhưng nhóm cha có trưởng P
- **THEN** người duyệt cấp 1 là P

#### Scenario: Vòng lặp nhóm cha
- **WHEN** dữ liệu `parentId` tạo vòng lặp
- **THEN** hệ thống dừng sau tối đa 10 bước, không treo

### Requirement: Người là quản lý thấy tab Chờ duyệt
Hệ thống SHALL coi một người là người duyệt tiềm năng nếu họ là trưởng của ít nhất 1 đơn vị HOẶC có ít nhất 1 người khai họ trong `directManagerIds`.

#### Scenario: Chỉ được khai trong directManagerIds
- **WHEN** một người không là trưởng đơn vị nào nhưng có nhân viên khai họ trong `directManagerIds`
- **THEN** họ thấy tab Chờ duyệt

### Requirement: Form đặt lịch gợi ý Quản lý trực tiếp
Form đặt lịch SHALL điền sẵn Quản lý trực tiếp đã xác định của người đặt kèm nhãn "Quản lý trực tiếp", và SHALL vẫn cho chọn người khác.

#### Scenario: Đổi người duyệt tay
- **WHEN** người đặt bấm "Đổi" và chọn người khác
- **THEN** booking được tạo với người đã chọn làm người duyệt cấp 1; cấp 2 vẫn là trưởng phòng Nhân sự

#### Scenario: Booking cũ không đổi
- **WHEN** luật mới được áp dụng
- **THEN** người duyệt đã lưu trên các booking tạo trước đó giữ nguyên
