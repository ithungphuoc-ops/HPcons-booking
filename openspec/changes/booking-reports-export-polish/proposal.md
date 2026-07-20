## Why

Đối chiếu với tài liệu "HP Core Booking – 6 Giai Đoạn" (Giai đoạn 6): trang Báo cáo hiện chỉ lọc được theo nhóm tài nguyên, không lọc theo khoảng ngày tuỳ chọn/tài nguyên cụ thể/người đặt/trạng thái/phòng ban, và không xuất được dữ liệu ra file. Đây là Đợt 5/5 (đợt cuối) của lộ trình nâng cấp Booking đã được Sếp duyệt — sau đợt này sẽ rà lại toàn bộ các luồng đã làm ở 4 đợt trước.

## What Changes

- Trang Báo cáo thêm bộ lọc: khoảng ngày tuỳ chọn (mặc định 30 ngày gần nhất như hiện tại), tài nguyên cụ thể (không chỉ theo nhóm), người đặt, trạng thái, phòng ban (suy ra từ người đặt).
- Thêm nút xuất Excel cho đúng tập dữ liệu đang lọc, xử lý hoàn toàn ở server (dùng `xlsx` đã thêm ở Đợt 3, không đưa vào bundle client — giữ đúng nguyên tắc "nhẹ app" đã theo suốt việc tách Booking).
- Rà lại nhanh 4 đợt trước: xác nhận không có lỗi rõ ràng nào còn sót (dựa trên đọc lại code, không phải chạy UI thật — việc test UI thật vẫn cần Sếp/trình duyệt thật).

## Capabilities

### New Capabilities
- `booking-reporting`: Báo cáo Booking có bộ lọc đầy đủ (ngày/tài nguyên/người đặt/trạng thái/phòng ban) và xuất Excel.

### Modified Capabilities
(không có)

## Impact

- `app/(booking)/bookings/reports/page.tsx`: thêm UI bộ lọc, nút xuất Excel.
- Route mới `app/api/bookings/export/route.ts`: nhận cùng bộ tham số lọc như trang báo cáo, trả về file `.xlsx` tải trực tiếp.
- Không ảnh hưởng dữ liệu production hiện có — chỉ đọc dữ liệu, không ghi.
