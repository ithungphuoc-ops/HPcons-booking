## 1. Luật

- [x] 1.1 `lib/quanLyTrucTiep.ts`: hàm thuần `resolveDirectManagerIdThuan` + `docDirectManagerIds`.
- [x] 1.2 `lib/firestore/departments.ts`: `getDirectManagerId` dùng luật mới (đọc sống); `isAnyDepartmentLeader` thêm truy vấn `directManagerIds array-contains`; `listAllDepartments` trả thêm `parentId`.
- [x] 1.3 `lib/firestore/types.ts`: thêm trường tuỳ chọn `directManagerIds`, `secondaryDepartmentIds`, `parentId`.

## 2. Giao diện / API

- [x] 2.1 `app/api/managers/route.ts`: `defaultManagerId` = quản lý trực tiếp đã resolve, trả thêm `directManagerIds`, `managerIds` đưa `directManagerIds` lên đầu.
- [x] 2.2 `components/booking/BookingFormDialog.tsx`: nhãn "Quản lý trực tiếp", giữ thứ tự gợi ý, vẫn đổi tay được.
- [x] 2.3 `app/api/members/route.ts`: `manager_name` theo luật mới.

## 3. Kiểm

- [x] 3.1 Script dữ liệu giả 10 ca (scratchpad), `npx tsc --noEmit`, `npm run build`.
