'use client'

// AppLauncher — danh mục ứng dụng công ty, chuẩn thị giác theo mẫu app tổng
// (hpcons-portal/components/layout/AppLauncher.tsx). Danh sách app lấy SỐNG từ
// account.hpcore.vn/api/apps (nguồn duy nhất) — không còn chép tay từ
// lib/dashboardApps.ts nữa, tránh lệch dữ liệu giữa các app con.
//
// Từ 12/09/2026 App Tổng đổi chuẩn: 5 nhóm (group/groupLabel) + màu theo nhóm
// (groupColor, hex). Ô icon tô nền đặc bằng inline style từ groupColor nên
// KHÔNG phụ thuộc safelist Tailwind; icon lấy từ iconKeyNew (tên Lucide thật),
// API không còn trả ảnh 3D (image luôn null). Nếu API cũ thiếu group thì rơi
// về 2 nhóm theo category + class màu app.color như trước.
import HighlightMatch, { normalizeSearch } from '@/components/ui/HighlightMatch'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AppWindow, BarChart3, Boxes, Briefcase, BriefcaseBusiness, CalendarClock, ClipboardCheck,
  ClipboardList, Clock, FileCheck, FileCheck2, Gavel, Gift, Handshake, Heart, Laptop, ListChecks,
  MapPin, Package, PenTool, Receipt, Search, Send, Settings, ShoppingCart, UserRound, Warehouse,
  Workflow, X,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '@/types'

const APPS_API = 'https://account.hpcore.vn/api/apps'
const HPCORE_DASHBOARD_URL = 'https://account.hpcore.vn/dashboard'
const HPCORE_PROFILE_URL = 'https://account.hpcore.vn/profile'
const CURRENT_APP_HOST = 'booking.hpcore.vn'

// Cùng bộ khoá icon với hpcons-portal/lib/dashboardApps.ts — app nào chưa có
// trong danh sách này thì rơi về icon mặc định (AppWindow).
// Gồm cả tên Lucide THẬT (iconKeyNew, từ 12/09/2026) lẫn tên CŨ (iconKey:
// FileCheck, ClipboardCheck, Briefcase, Heart...) để fallback khi API cũ.
const ICONS: Record<string, LucideIcon> = {
  // iconKeyNew
  Clock, FileCheck2, ClipboardList, CalendarClock, Send, UserRound, Gift, BriefcaseBusiness,
  Gavel, PenTool, Handshake, Package, ShoppingCart, Boxes, Warehouse, Receipt, Laptop, BarChart3,
  MapPin, Settings, ListChecks, Workflow,
  // iconKey cũ (fallback)
  FileCheck, ClipboardCheck, Briefcase, Heart,
}

// 5 nhóm chuẩn App Tổng (12/09/2026) — thứ tự cố định, nhãn/màu fallback khi
// app trong nhóm thiếu groupLabel/groupColor.
const GROUP_ORDER = ['hr', 'sales', 'supply', 'finance', 'system'] as const
type GroupKey = (typeof GROUP_ORDER)[number]
const GROUP_META: Record<GroupKey, { label: string; color: string; subtitle: string }> = {
  hr:      { label: 'Nhân sự & Hành chính', color: '#096AA7', subtitle: 'Chấm công, đơn từ, đề xuất, đặt phòng, liên lạc, quà tặng' },
  sales:   { label: 'Kinh doanh & Dự án',   color: '#0E8A5F', subtitle: 'Khách hàng, đấu thầu, thiết kế, cuộc họp' },
  supply:  { label: 'Kho & Mua hàng',       color: '#B7791F', subtitle: 'Kho công trình, thu mua, kho ERP' },
  finance: { label: 'Tài chính & Tài sản',  color: '#0F7E8C', subtitle: 'Công nợ, tài sản IT' },
  system:  { label: 'Quản trị hệ thống',    color: '#4B5B6B', subtitle: 'Báo cáo, cấu hình, phân quyền' },
}

type RemoteApp = {
  name: string
  description?: string
  iconKey?: string
  iconKeyNew?: string
  color?: string
  category?: 'ops' | 'business'
  group?: string
  groupLabel?: string
  groupColor?: string
  groupSoftColor?: string
  image?: string | null
  href?: string | null
  comingSoon?: boolean
  launchDate?: string | null
}

type AppGroup = { key: string; title: string; subtitle: string; color?: string; items: RemoteApp[] }

/**
 * FALLBACK (API cũ thiếu groupColor): app.color trả về từ API là chuỗi Tailwind
 * (vd "bg-blue-500") đọc lúc CHẠY, Tailwind quét mã nguồn lúc BUILD nên không
 * thấy được — phải liệt kê literal ở đây để class được biên dịch ra CSS (bài
 * học 31/07/2026 ở ttcuochop). Từ 12/09/2026 màu chính lấy từ groupColor qua
 * inline style nên không cần safelist; giữ danh sách này cho đường fallback.
 * Đủ bộ màu hiện có trong hpcons-portal/lib/dashboardApps.ts:
 * bg-amber-500 bg-blue-500 bg-cyan-500 bg-emerald-500 bg-fuchsia-500 bg-gray-500 bg-green-500 bg-orange-600
 * bg-indigo-500 bg-lime-500 bg-orange-500 bg-pink-500 bg-purple-500 bg-red-500 bg-rose-500
 * bg-sky-500 bg-teal-500 bg-violet-500 bg-yellow-500 bg-slate-500
 */

// 'YYYY-MM-DD' -> 'dd/MM' (tách chuỗi trực tiếp, tránh lệch múi giờ khi parse Date)
function formatLaunchDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export default function AppLauncher({
  user, onClose, onLogout,
}: { user: User | null; onClose: () => void; onLogout: () => void }) {
  const [q, setQ] = useState('')
  const [apps, setApps] = useState<RemoteApp[] | null>(null)

  useEffect(() => {
    let ok = true
    fetch(APPS_API)
      .then((r) => r.json())
      .then((d) => { if (ok) setApps(Array.isArray(d.apps) ? d.apps : []) })
      .catch(() => { if (ok) setApps([]) })
    return () => { ok = false }
  }, [])

  const ql = normalizeSearch(q.trim())
  const match = (a: RemoteApp) =>
    !ql || normalizeSearch(a.name).includes(ql) || normalizeSearch(a.description ?? '').includes(ql)
  const list = apps ?? []

  // Có app mang `group` (API mới 12/09/2026) → 5 nhóm cố định theo GROUP_ORDER;
  // không có → giữ 2 nhóm cũ theo `category` để tương thích API cũ.
  const hasGroup = list.some(a => !!a.group)
  const groups: AppGroup[] = (hasGroup
    ? GROUP_ORDER.map((key): AppGroup => {
        const items = list.filter(a => a.group === key).filter(match)
        const meta = GROUP_META[key]
        return {
          key,
          title: items[0]?.groupLabel || meta.label,
          subtitle: meta.subtitle,
          color: items[0]?.groupColor || meta.color,
          items,
        }
      })
    : [
        { key: 'ops', title: 'Nhân sự & Vận hành', subtitle: 'Chấm công, đơn từ, đặt phòng, báo cáo...', items: list.filter(a => a.category !== 'business').filter(match) },
        { key: 'business', title: 'Ứng dụng nghiệp vụ', subtitle: 'Kinh doanh, kho, tài sản, quy trình...', items: list.filter(a => a.category === 'business').filter(match) },
      ]
  ).filter(g => g.items.length > 0)

  // Portal ra document.body: sidebar di động dùng transition-transform (kể cả
  // translate-x-0) làm chính <aside> đó trở thành khung chứa MỚI cho mọi phần
  // tử con position:fixed (đúng theo spec CSS) — panel này lồng bên trong nên
  // bị nhốt/cắt trong bề ngang ngăn kéo thay vì phủ toàn màn hình (bug thật
  // phát hiện qua code review 18/08/2026, xảy ra trên điện thoại). Portal
  // thoát hẳn ra ngoài mọi tổ tiên transform, fixed luôn tính theo viewport.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-start p-3 sm:py-4 sm:pl-24 sm:pr-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-5 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt={user.full_name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ backgroundColor: 'var(--hp-primary, #096AA7)' }}>
                {user?.full_name?.charAt(0) ?? 'U'}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{user?.full_name ?? 'Cá nhân'}</p>
              <p className="text-xs text-gray-400">
                {list.length} ứng dụng ·{' '}
                <a href={HPCORE_DASHBOARD_URL} className="text-blue-600 hover:underline">Về App Tổng</a> ·{' '}
                <a href={HPCORE_PROFILE_URL} className="text-blue-600 hover:underline">Tài khoản</a> ·{' '}
                <button onClick={onLogout} className="text-blue-600 hover:underline">Đăng xuất</button>
              </p>
            </div>
          </div>
          <div className="relative sm:ml-auto sm:w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q} onChange={e => setQ(e.target.value)} autoFocus
              placeholder="Tìm kiếm ứng dụng"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button onClick={onClose} aria-label="Đóng" className="hidden sm:flex w-8 h-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Nhóm ứng dụng */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-7">
          {apps === null ? (
            <p className="text-center text-gray-400 py-10">Đang tải danh sách ứng dụng…</p>
          ) : groups.length === 0 ? (
            <p className="text-center text-gray-400 py-10">Không tìm thấy ứng dụng phù hợp</p>
          ) : (
            groups.map(g => (
              <div key={g.key}>
                <div className="flex items-center gap-2">
                  {g.color && (
                    <span aria-hidden className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: g.color }} />
                  )}
                  <p className="font-semibold text-gray-800">{g.title}</p>
                  <span className="ml-auto text-xs text-gray-400 tabular-nums">{g.items.length}</span>
                </div>
                <p className={`text-xs text-gray-400 mb-3 ${g.color ? 'pl-[18px]' : ''}`}>{g.subtitle}</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {g.items.map(app => <AppTile key={app.name} app={app} onNavigate={onClose} query={ql} />)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AppTile({ app, onNavigate, query }: { app: RemoteApp; onNavigate: () => void; query: string }) {
  const Icon = (app.iconKeyNew && ICONS[app.iconKeyNew]) || (app.iconKey && ICONS[app.iconKey]) || AppWindow
  const current = !!app.href && app.href.includes(CURRENT_APP_HOST)
  // Nền đặc màu nhóm qua inline style (12/09/2026); thiếu groupColor → class
  // Tailwind app.color cũ (đã safelist ở comment đầu file).
  const tileBg = app.groupColor ? '' : (app.color ?? 'bg-slate-500')
  const inner = (
    <>
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden transition-transform group-hover:scale-105 ${tileBg} ${app.comingSoon ? 'opacity-50' : ''}`}
        style={app.groupColor ? { backgroundColor: app.groupColor } : undefined}
      >
        <Icon size={26} strokeWidth={1.75} className="text-white" />
      </div>
      <p className={`text-xs font-medium text-center leading-tight ${app.comingSoon ? 'text-gray-400' : 'text-gray-700'}`}>
        <HighlightMatch text={app.name} query={query} />
      </p>
      {current && (
        <span className="text-[9px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Đang dùng</span>
      )}
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
  if (current) return <div className={cls}>{inner}</div>
  return <a href={app.href} target="_blank" rel="noopener noreferrer" onClick={onNavigate} className={cls}>{inner}</a>
}
