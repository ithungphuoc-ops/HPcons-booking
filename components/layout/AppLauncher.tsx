'use client'

import Link from 'next/link'
import HighlightMatch, { normalizeSearch } from '@/components/ui/HighlightMatch'
import { useState } from 'react'
import { X, Search, Users, Network, Users2, UserPlus, ShieldCheck, History, type LucideIcon } from 'lucide-react'
import { DASHBOARD_APPS, type DashboardApp } from '@/lib/dashboardApps'
import type { Role, User } from '@/types'

type LauncherItem = {
  name: string
  description?: string
  icon: LucideIcon
  color: string
  image?: string
  href?: string
  comingSoon?: boolean
  launchDate?: string
}

// 'YYYY-MM-DD' -> 'dd/MM' (tách chuỗi trực tiếp, tránh lệch múi giờ khi parse Date)
function formatLaunchDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function AppLauncher({
  user, isApprover, isAdmin, isOwner, onClose, onLogout,
}: { user: User | null; isApprover: boolean; isAdmin: boolean; isOwner: boolean; onClose: () => void; onLogout: () => void }) {
  const [q, setQ] = useState('')
  const role = (user?.role ?? 'employee') as Role
  const roleForApps: Role = role === 'owner' ? 'admin' : role

  const ql = normalizeSearch(q.trim())
  const match = (a: LauncherItem) =>
    !ql || normalizeSearch(a.name).includes(ql) || normalizeSearch(a.description ?? '').includes(ql)

  const apps: DashboardApp[] = DASHBOARD_APPS.filter(a => a.roles.includes(roleForApps))

  // Toàn bộ mục quản trị dưới đây thuộc app tổng (hpcons-portal), không phải
  // Booking — dùng href TUYỆT ĐỐI vì AppLauncher này chạy trong app Booking
  // độc lập, không còn nằm chung deploy với các trang /dashboard/* nữa.
  const ACCOUNT_BASE = 'https://account.hpcore.vn'
  const adminItems: LauncherItem[] = [
    ...(isApprover ? [
      { name: 'Thành viên', description: 'Quản lý nhân sự', icon: Users, color: 'bg-slate-500', href: `${ACCOUNT_BASE}/dashboard/members` },
      { name: 'Nhóm', description: 'Đơn vị / phòng ban', icon: Network, color: 'bg-slate-500', href: `${ACCOUNT_BASE}/dashboard/units` },
    ] : []),
    // Nhóm thành viên linh hoạt (khác "Nhóm" = đơn vị org-chart cứng ở trên)
    // — quản trị nội bộ app tổng, cùng cấp admin như Thành viên/Đơn vị.
    ...(isAdmin ? [
      { name: 'Nhóm thành viên', description: 'Nhóm linh hoạt cắt ngang phòng ban', icon: Users2, color: 'bg-slate-500', href: `${ACCOUNT_BASE}/dashboard/member-groups` },
    ] : []),
    { name: 'TK Khách', description: 'Tài khoản khách', icon: UserPlus, color: 'bg-slate-500', href: `${ACCOUNT_BASE}/dashboard/guests` },
    // Chỉ owner (không phải admin/manager) — gán quyền cho từng ứng dụng
    // (con lẫn nội bộ), theo mô hình Base Account: chỉ Owner chỉ định App Admin.
    ...(isOwner ? DASHBOARD_APPS.filter(a => a.rolesEndpoint || a.internalRoles).map(a => ({
      // "HPC Warehouse" -> "Warehouse" (có dấu cách) và "HPCons-KhoCtr" -> "KhoCtr"
      // (không dấu cách, gạch nối) — 2 kiểu đặt tên khác nhau trong hệ sinh thái,
      // regex cũ chỉ cắt đúng chữ "HPC " nên "HPCons-KhoCtr" bị cắt thành "ons-KhoCtr".
      name: `Quyền ${a.name.replace(/^HPC(?:ons)?[\s-]*/, '')}`,
      description: `Gán vai trò nhân viên trong ${a.name}`,
      icon: ShieldCheck,
      color: 'bg-slate-500',
      href: `${ACCOUNT_BASE}/dashboard/apps/${a.id}`,
    })) : []),
    ...(isAdmin ? [
      { name: 'Nhật ký hoạt động', description: 'Hoạt động quản trị & lịch sử đăng nhập', icon: History, color: 'bg-slate-500', href: `${ACCOUNT_BASE}/dashboard/activity` },
    ] : []),
  ]

  const groups: { title: string; subtitle: string; items: LauncherItem[] }[] = [
    { title: 'Nhân sự & Vận hành', subtitle: 'Chấm công, đơn từ, đặt phòng, báo cáo...', items: apps.filter(a => a.category === 'ops').filter(match) },
    { title: 'Ứng dụng nghiệp vụ', subtitle: 'Kinh doanh, kho, tài sản, quy trình...', items: apps.filter(a => a.category === 'business').filter(match) },
    { title: 'Quản trị & Hệ thống', subtitle: 'Quản lý người dùng, phân quyền', items: adminItems.filter(match) },
  ].filter(g => g.items.length > 0)

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-start p-3 sm:py-4 sm:pl-24 sm:pr-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.full_name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-[#1B75BB] flex items-center justify-center text-white font-bold flex-shrink-0">
                {user?.full_name?.charAt(0) ?? 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{user?.full_name ?? 'Cá nhân'}</p>
              <p className="text-xs text-gray-400">
                {apps.length} ứng dụng ·{' '}
                <a href="https://account.hpcore.vn/profile" className="text-blue-600 hover:underline">Tài khoản</a> ·{' '}
                <button onClick={onLogout} className="text-blue-600 hover:underline">Đăng xuất</button>
              </p>
            </div>
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q} onChange={e => setQ(e.target.value)} autoFocus
              placeholder="Tìm kiếm ứng dụng"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={onClose} aria-label="Đóng" className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Nhóm ứng dụng */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-7">
          {groups.length === 0 && <p className="text-center text-gray-400 py-10">Không tìm thấy ứng dụng phù hợp</p>}
          {groups.map(g => (
            <div key={g.title}>
              <p className="font-semibold text-gray-800">{g.title}</p>
              <p className="text-xs text-gray-400 mb-3">{g.subtitle}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {g.items.map(app => <AppTile key={app.name} app={app} onNavigate={onClose} query={ql} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


function AppTile({ app, onNavigate, query }: { app: LauncherItem; onNavigate: () => void; query: string }) {
  const Icon = app.icon
  const inner = (
    <>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 ${app.image ? 'bg-white border border-gray-100' : app.color} ${app.comingSoon ? 'opacity-50' : ''}`}>
        {app.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={app.image} alt={app.name} className="w-full h-full object-cover scale-[1.15]" />
        ) : (
          <Icon size={26} className="text-white" />
        )}
      </div>
      <p className={`text-xs font-medium text-center leading-tight ${app.comingSoon ? 'text-gray-400' : 'text-gray-700'}`}><HighlightMatch text={app.name} query={query} /></p>
      {app.comingSoon && (
        <span className="text-[9px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
          {app.launchDate ? `Ra mắt ${formatLaunchDate(app.launchDate)}` : 'Sắp ra mắt'}
        </span>
      )}
    </>
  )
  const cls = 'group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-gray-50 transition-colors'
  if (app.comingSoon || !app.href) {
    const title = app.launchDate ? `Ra mắt ${formatLaunchDate(app.launchDate)}` : 'Sắp ra mắt'
    return <div className={`${cls} cursor-default`} title={title}>{inner}</div>
  }
  if (/^https?:\/\//.test(app.href)) return <a href={app.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls}>{inner}</a>
  return <Link href={app.href} onClick={onNavigate} className={cls}>{inner}</Link>
}
