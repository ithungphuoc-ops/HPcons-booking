## ADDED Requirements

### Requirement: Bộ lọc báo cáo đầy đủ
Trang Báo cáo SHALL cho phép lọc theo khoảng ngày tuỳ chọn, tài nguyên cụ thể, người đặt, trạng thái, và phòng ban — độc lập hoặc kết hợp.

#### Scenario: Lọc theo khoảng ngày tuỳ chọn
- **WHEN** người dùng chọn khoảng ngày khác 30 ngày mặc định
- **THEN** báo cáo cập nhật đúng dữ liệu trong khoảng ngày mới

#### Scenario: Lọc theo người đặt
- **WHEN** người dùng chọn 1 người đặt cụ thể
- **THEN** báo cáo chỉ hiển thị đăng ký của đúng người đó trong khoảng ngày đang chọn

#### Scenario: Lọc theo phòng ban
- **WHEN** người dùng chọn 1 phòng ban
- **THEN** báo cáo chỉ hiển thị đăng ký của những người thuộc phòng ban đó

### Requirement: Xuất Excel theo đúng bộ lọc đang áp dụng
Người dùng SHALL có thể xuất ra file Excel đúng tập dữ liệu đang được lọc trên trang Báo cáo.

#### Scenario: Xuất file với bộ lọc đang áp dụng
- **WHEN** người dùng đã áp dụng bộ lọc (vd theo phòng ban + khoảng ngày) và bấm "Xuất Excel"
- **THEN** hệ thống tải về 1 file Excel chỉ chứa đúng các đăng ký khớp bộ lọc đó

#### Scenario: Xuất khi không có bộ lọc nào
- **WHEN** người dùng bấm "Xuất Excel" mà không áp dụng bộ lọc nào ngoài khoảng ngày mặc định
- **THEN** hệ thống tải về file chứa toàn bộ đăng ký trong 30 ngày gần nhất
