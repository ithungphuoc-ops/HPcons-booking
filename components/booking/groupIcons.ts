import { Car, Building2, Home, Truck, Package, type LucideIcon } from 'lucide-react'

// Khoá icon Lucide dùng cho bookingGroups.icon — mở rộng dần khi cần nhóm mới.
export const GROUP_ICONS: Record<string, LucideIcon> = {
  Car,
  Building2,
  Home,
  Truck,
  Package,
}

export function groupIcon(key: string): LucideIcon {
  return GROUP_ICONS[key] ?? Package
}
