import {
  Clock, MapPin, Settings, BarChart3, FileCheck, CalendarClock, Send,
  Warehouse, Briefcase, Receipt, Workflow as WorkflowIcon, Heart, Laptop, PenTool, ClipboardCheck, type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types'

export type AppRoleOption = { key: string; label: string }

export type DashboardApp = {
  id?: string
  name: string
  description: string
  icon: LucideIcon
  iconKey: string
  color: string
  roles: Role[]
  image?: string
  comingSoon?: boolean
  launchDate?: string
  href?: string
  rolesEndpoint?: string
  internalRoles?: AppRoleOption[]
}

// Bản sao rút gọn của lib/dashboardApps.ts (hpcons-portal) — chỉ dùng để
// dựng "Danh mục ứng dụng" (AppLauncher) trong app Booking độc lập. Các href
// nội bộ app tổng (/dashboard/...) và ảnh (/landing-icons/...) đã đổi thành
// tuyệt đối https://account.hpcore.vn/... vì không còn nằm chung deploy;
// href "/bookings" giữ nguyên (giờ là route nội bộ của chính app này).
// KHÔNG sửa danh sách này ở đây — sửa ở hpcons-portal rồi đồng bộ lại thủ công.
const ACCOUNT_BASE = 'https://account.hpcore.vn'

export const DASHBOARD_APPS: DashboardApp[] = [
  {
    name: 'Chấm công',
    description: 'Quản lý giờ vào/ra',
    icon: Clock, iconKey: 'Clock',
    color: 'bg-blue-500',
    href: `${ACCOUNT_BASE}/dashboard/attendance`,
    roles: ['admin', 'manager', 'employee'] as Role[],
  },
  {
    name: 'Địa điểm',
    description: 'Danh sách địa điểm',
    icon: MapPin, iconKey: 'MapPin',
    color: 'bg-green-500',
    href: `${ACCOUNT_BASE}/dashboard/worksites`,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    name: 'Đơn từ',
    description: 'Nghỉ phép, tăng ca, phê duyệt',
    icon: FileCheck, iconKey: 'FileCheck',
    color: 'bg-rose-500',
    href: `${ACCOUNT_BASE}/dashboard/requests`,
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-request.png`,
  },
  {
    name: 'Nhóm Telegram',
    description: 'Đăng ký & phê duyệt nhóm',
    icon: Send, iconKey: 'Send',
    color: 'bg-sky-500',
    href: `${ACCOUNT_BASE}/dashboard/telegram-groups`,
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/telegram.png`,
  },
  {
    name: 'Booking',
    description: 'Đặt phòng họp & xe',
    icon: CalendarClock, iconKey: 'CalendarClock',
    color: 'bg-teal-500',
    href: '/bookings',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-booking.png`,
  },
  {
    name: 'Báo cáo',
    description: 'Thống kê & xuất Excel',
    icon: BarChart3, iconKey: 'BarChart3',
    color: 'bg-orange-500',
    href: `${ACCOUNT_BASE}/dashboard/reports`,
    roles: ['admin', 'manager'] as Role[],
  },
  {
    name: 'Cài đặt',
    description: 'Hệ thống & phân quyền',
    icon: Settings, iconKey: 'Settings',
    color: 'bg-gray-500',
    href: `${ACCOUNT_BASE}/dashboard/settings`,
    roles: ['admin'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-account.png`,
  },
  {
    id: 'warehouse',
    name: 'HPC Warehouse',
    description: 'Quản lý xuất nhập tồn vật tư, thiết bị',
    icon: Warehouse, iconKey: 'Warehouse',
    color: 'bg-amber-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-warehouse.png`,
    href: 'https://khoct.hpcore.vn',
    rolesEndpoint: 'https://khoct.hpcore.vn/api/roles',
  },
  {
    name: 'HPC Design',
    description: 'Quản lý công việc, bản vẽ và tiến độ Phòng Thiết kế',
    icon: PenTool, iconKey: 'PenTool',
    color: 'bg-violet-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-design.png`,
    href: 'https://tk.hpcore.vn',
  },
  {
    id: 'pkd',
    name: 'HPC PKD',
    description: 'Quản lý khách hàng và cơ hội cho phòng kinh doanh',
    icon: Briefcase, iconKey: 'Briefcase',
    color: 'bg-indigo-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-pkd.png`,
    href: 'https://pkd.hpcore.vn',
    rolesEndpoint: 'https://pkd.hpcore.vn/api/roles',
  },
  {
    name: 'HPCons-CongNo',
    description: 'Theo dõi công nợ phải thu và dòng tiền',
    icon: Receipt, iconKey: 'Receipt',
    color: 'bg-lime-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-receivable.png`,
    href: 'https://congno.hpcore.vn',
  },
  {
    name: 'HPC Workflow',
    description: 'Quy trình duyệt liên phòng ban, theo dõi tiến độ',
    icon: WorkflowIcon, iconKey: 'Workflow',
    color: 'bg-cyan-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-workflow.png`,
    comingSoon: true,
  },
  {
    name: 'HPC ME',
    description: 'Hồ sơ và tiện ích cá nhân dành cho nhân viên',
    icon: Heart, iconKey: 'Heart',
    color: 'bg-pink-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-me.png`,
    comingSoon: true,
  },
  {
    id: 'itasset',
    name: 'HPC ITAsset',
    description: 'Quản lý thiết bị, bàn giao và thu hồi tài sản',
    icon: Laptop, iconKey: 'Laptop',
    color: 'bg-emerald-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    image: `${ACCOUNT_BASE}/landing-icons/hpc-itasset.png`,
    href: 'https://itasset.hpcore.vn',
    rolesEndpoint: 'https://itasset.hpcore.vn/api/roles',
  },
  {
    name: 'Đề xuất',
    description: 'Nhóm đề xuất, phiếu, phê duyệt nội bộ',
    icon: ClipboardCheck, iconKey: 'ClipboardCheck',
    color: 'bg-fuchsia-500',
    roles: ['admin', 'manager', 'employee'] as Role[],
    href: 'https://request.hpcore.vn',
  },
]
