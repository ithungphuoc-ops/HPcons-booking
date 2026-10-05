## ADDED Requirements

### Requirement: Lưới giờ cho chế độ Tuần và Ngày
Hệ thống SHALL hiển thị chế độ xem Tuần và Ngày của trang `/bookings` dạng lưới giờ trực quan: trục giờ cố định bên trái và các đăng ký đặt tại vị trí/chiều cao tương ứng với `start_at`/`end_at` thật, thay cho danh sách chip theo giờ hiện có.

#### Scenario: Biên giờ mặc định
- **WHEN** mọi đăng ký trong tuần/ngày đang xem đều nằm trong khoảng 06:00–22:00
- **THEN** lưới giờ hiển thị đúng khoảng 06:00–22:00, không hiện thừa giờ trống ngoài khoảng đó

#### Scenario: Tự giãn biên khi có đăng ký ngoài giờ mặc định
- **WHEN** có ít nhất 1 đăng ký trong tuần/ngày đang xem bắt đầu trước 06:00 hoặc kết thúc sau 22:00
- **THEN** lưới giờ tự giãn biên để hiển thị đủ đăng ký đó, không được cắt hoặc ẩn đăng ký nằm ngoài khoảng mặc định

#### Scenario: Biên giờ đồng nhất trong cùng 1 tuần
- **WHEN** đang ở chế độ Tuần
- **THEN** cả 7 cột ngày dùng chung 1 biên giờ (tính theo đăng ký "xa biên" nhất trong cả tuần), không để mỗi ngày có chiều cao trục giờ khác nhau

### Requirement: Xếp cạnh đăng ký trùng giờ khác tài nguyên
Vì 1 cột ngày có thể chứa đăng ký của nhiều tài nguyên khác nhau, hệ thống SHALL xếp các đăng ký trùng giờ cạnh nhau theo thuật toán đóng gói cột (column packing), không được chồng đè làm mất nội dung.

#### Scenario: Hai đăng ký không trùng giờ
- **WHEN** 2 đăng ký trong cùng ngày có khung giờ không giao nhau
- **THEN** cả hai chiếm đủ chiều rộng cột ngày (không chia cột)

#### Scenario: Hai đăng ký trùng giờ
- **WHEN** 2 đăng ký trong cùng ngày có khung giờ giao nhau (dù chỉ 1 phút)
- **THEN** mỗi đăng ký được xếp vào 1 cột con riêng trong cùng ngày, chiều rộng chia đều, không đăng ký nào bị che khuất hoàn toàn

#### Scenario: Giữ màu/thông tin đang có
- **WHEN** đăng ký được vẽ trong lưới giờ
- **THEN** vẫn dùng đúng màu theo `resource.color`/trạng thái và các style đang định nghĩa ở `statusColors.ts`, không đổi ý nghĩa màu

### Requirement: Bấm chọn khung giờ để tạo đăng ký nhanh
Hệ thống SHALL cho phép bấm vào 1 vị trí trống trong lưới giờ (Tuần hoặc Ngày) để chọn nhanh 1 khung giờ và mở luồng tạo đăng ký hiện có (`QuickBookModal` → `BookingFormDialog`) với giờ đã điền sẵn.

#### Scenario: Bấm vào ô trống
- **WHEN** người dùng bấm vào 1 vị trí trống (không trúng đăng ký đã có) trong lưới giờ của 1 ngày
- **THEN** hệ thống tính giờ bắt đầu theo toạ độ bấm, làm tròn về mốc 30 phút gần nhất, đặt giờ kết thúc là giờ bắt đầu cộng 1 tiếng (không vượt biên lưới giờ đang hiển thị)

#### Scenario: Hiện khung chọn kèm nút tạo nhanh
- **WHEN** đã tính được khung giờ từ cú bấm
- **THEN** hệ thống hiển thị ngay 1 khung trực quan tại đúng vị trí/chiều cao đó kèm nhãn giờ bắt đầu–kết thúc và 1 nút rõ ràng để mở biểu mẫu tạo đăng ký (không yêu cầu bấm thêm lần thứ hai để "xác nhận chọn")

#### Scenario: Mở đúng luồng hiện có với giờ chính xác
- **WHEN** người dùng bấm nút tạo nhanh trong khung đã chọn
- **THEN** hệ thống mở `QuickBookModal` (chọn nhóm → tài nguyên) như luồng "Đăng kí ngay" hiện có; sau khi chọn tài nguyên, `BookingFormDialog` mở ra với `initialSlot` đúng bằng khung giờ đã chọn (không còn mặc định cố định 08:00–09:00)

#### Scenario: Đóng khung chọn
- **WHEN** người dùng bấm ra ngoài khung đã chọn hoặc nhấn Esc
- **THEN** khung chọn biến mất, không để sót trạng thái chọn cũ khi chuyển ngày/tuần hoặc đổi chế độ xem

### Requirement: Không đổi hành vi nghiệp vụ hiện có
Thay đổi này SHALL chỉ ảnh hưởng cách hiển thị lịch và cách mở biểu mẫu kèm giờ điền sẵn, không được làm thay đổi hành vi nghiệp vụ khác.

#### Scenario: API và transaction không đổi
- **WHEN** đăng ký được tạo từ luồng bấm-chọn khung giờ mới
- **THEN** hệ thống vẫn gọi đúng API `/api/bookings` và transaction chặn trùng lịch hiện có, không có đường tạo đăng ký nào bỏ qua kiểm tra xung đột

#### Scenario: Chế độ Tháng không đổi
- **WHEN** người dùng đang ở chế độ xem Tháng
- **THEN** hành vi bấm vào ngày giữ nguyên như hiện tại (mở `QuickBookModal` với khung giờ mặc định 08:00–09:00), không bị ảnh hưởng bởi thay đổi này
