## Why

Sếp duyệt (03/10/2026) hợp đồng dữ liệu chung "Quản lý trực tiếp": App Tổng thêm `users.directManagerIds` (có thứ tự, tối đa 3), `users.secondaryDepartmentIds` (kiêm nhiệm) và `departments.parentId` (nhóm cha). Booking đang tự tính quản lý trực tiếp = trưởng đơn vị chính và gợi ý trong form theo `memberGroups.managerId` — lệch với luật mới và lệch cả với luật duyệt thật của chính Booking.

## What Changes

- Luật "Quản lý trực tiếp" tách thành hàm thuần `lib/quanLyTrucTiep.ts`: directManagerIds → trưởng đơn vị chính → trưởng nhóm cha (tối đa 10 bước) → null.
- `getDirectManagerId` (người duyệt cấp 1 khi tạo/sửa giờ booking) dùng luật mới.
- `isAnyDepartmentLeader` (tab Chờ duyệt) đúng thêm khi có user khai mình trong `directManagerIds`.
- Form đặt lịch: gợi ý mặc định = Quản lý trực tiếp đã resolve (ghi nhãn "Quản lý trực tiếp"), vẫn chọn tay được (`manager_override_id`); danh sách chọn tay đưa `directManagerIds` lên đầu.
- `/api/members` `manager_name` dùng luật mới.
- KHÔNG đổi: luật cấp 2 (trưởng phòng Nhân sự), người duyệt đã lưu trên booking cũ, không ghi Firestore.

## Impact

- `lib/quanLyTrucTiep.ts` (mới), `lib/firestore/departments.ts`, `lib/firestore/types.ts`, `app/api/managers/route.ts`, `app/api/members/route.ts`, `components/booking/BookingFormDialog.tsx`.
- Thêm 1 truy vấn `users where directManagerIds array-contains uid limit 1` — index đơn trường tự có, không cần composite index.
