'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import {
  BellRing, ChevronDown, ChevronRight, Gift, Grid3x3, LogOut, Menu, Plus, Search, Target, BarChart3, X,
} from 'lucide-react'
import { getFirebaseAuth } from '@/lib/firebase/client'
import NotificationBell from '@/components/layout/NotificationBell'
import AppLauncher from '@/components/layout/AppLauncher'
import { groupIcon } from '@/components/booking/groupIcons'
import type { User } from '@/types'
import HighlightMatch, { normalizeSearch } from '@/components/ui/HighlightMatch'

interface ResourceOption { id: string; name: string }
interface GroupOption { id: string; name: string; icon: string; resources: ResourceOption[] }

function SidebarContent({ user, onNavigate }: { user: User | null; onNavigate?: () => void }) {
  const router = useRouter()
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [launcherOpen, setLauncherOpen] = useState(false)

  useEffect(() => {
    fetch('/api/booking-resources')
      .then((r) => r.json())
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]))
  }, [])

  async function handleLogout() {
    await fetch('/api/auth/session', { method: 'DELETE' })
    await signOut(getFirebaseAuth())
    router.push('/login')
    router.refresh()
  }

  const q = normalizeSearch(query.trim())
  const filteredGroups = q
    ? groups
        .map((g) => ({ ...g, resources: g.resources.filter((r) => normalizeSearch(r.name).includes(q)) }))
        .filter((g) => normalizeSearch(g.name).includes(q) || g.resources.length > 0)
    : groups

  return (
    <div className="flex h-full flex-col text-[13px] text-[#c9d6d0]">
      {/* Logo công ty (bấm mở Danh mục ứng dụng — quay lại app tổng) + thông báo */}
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <button
          type="button"
          onClick={() => setLauncherOpen(true)}
          title="Danh mục ứng dụng"
          className="rounded-lg p-1 transition-colors hover:bg-white/5"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="HP Cons" className="h-9 w-9 rounded bg-white object-contain p-0.5" />
        </button>
        <div className="flex items-center gap-1 [&_button]:h-8 [&_button]:w-8 [&_button]:text-[#9fb3aa] [&_button]:hover:bg-white/5 [&_button]:hover:text-white">
          <NotificationBell />
          <a
            href="https://quacuatoi.hpcore.vn"
            target="_blank"
            rel="noopener noreferrer"
            title="Quà của tôi"
            aria-label="Quà của tôi"
            className="relative flex h-8 w-8 items-center justify-center rounded-xl text-[#9fb3aa] hover:bg-white/5 hover:text-white"
          >
            <Gift size={16} />
            {/* Số điểm tạm để 0 — chưa nối UrBox thật, xem hpcons-quacuatoi/openspec */}
            <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold leading-none text-white">
              0
            </span>
          </a>
          <Link
            href="/bookings/settings/notifications"
            onClick={onNavigate}
            title="Cài đặt thông báo"
            aria-label="Cài đặt thông báo"
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#9fb3aa] hover:bg-white/5 hover:text-white"
          >
            <BellRing size={16} />
          </Link>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div className="px-3 pb-3">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7c958a]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm kiếm tài nguyên"
            className="w-full rounded bg-white/5 py-1.5 pl-8 pr-2 text-[12px] text-white placeholder:text-[#7c958a] outline-none focus:bg-white/10"
          />
        </div>
      </div>

      {/* Đăng kí ngay */}
      <div className="px-3 pb-3">
        <Link
          href="/bookings?new=1"
          onClick={onNavigate}
          className="flex items-center justify-center gap-2 rounded bg-[var(--booking-primary)] py-2 text-[12px] font-medium text-[#04140d] hover:brightness-95"
        >
          <Plus size={14} strokeWidth={2.5} /> Đăng kí ngay
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <Link
          href="/bookings"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-2.5 rounded px-2 py-2 hover:bg-white/5"
        >
          <Grid3x3 size={16} className="shrink-0 text-[#9fb3aa]" />
          <span>Home</span>
        </Link>

        {filteredGroups.map((group) => {
          const Icon = groupIcon(group.icon)
          const isCollapsed = collapsed[group.id]
          return (
            <div key={group.id} className="mb-1">
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [group.id]: !prev[group.id] }))}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7c958a] hover:bg-white/5"
              >
                <span className="truncate"><HighlightMatch text={group.name} query={q} /></span>
                {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
              {!isCollapsed && (
                <div className="flex flex-col gap-0.5">
                  {group.resources.map((res) => (
                    <Link
                      key={res.id}
                      href={`/bookings?group=${group.id}`}
                      onClick={onNavigate}
                      className="flex items-center gap-2.5 rounded px-2 py-1.5 pl-4 hover:bg-white/5"
                    >
                      <Icon size={14} className="shrink-0 text-[#9fb3aa]" />
                      <span className="truncate"><HighlightMatch text={res.name} query={q} /></span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}

        <p className="mb-1 mt-3 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#7c958a]">Tùy chỉnh</p>
        <Link href="/bookings/purposes" onClick={onNavigate} className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-white/5">
          <Target size={16} className="shrink-0 text-[#9fb3aa]" />
          <span>Mục đích</span>
        </Link>
        <Link href="/bookings/reports" onClick={onNavigate} className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-white/5">
          <BarChart3 size={16} className="shrink-0 text-[#9fb3aa]" />
          <span>Báo cáo</span>
        </Link>
      </div>

      <button
        type="button"
        onClick={handleLogout}
        className="mx-2 mb-3 flex items-center gap-2.5 rounded px-2 py-2 text-[#9fb3aa] hover:bg-white/5 hover:text-white"
      >
        <LogOut size={16} className="shrink-0" />
        <span>Đăng xuất</span>
      </button>

      {launcherOpen && (
        <AppLauncher
          user={user}
          onClose={() => setLauncherOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </div>
  )
}

export default function BookingSidebar({ user }: { user: User | null }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Desktop: cố định, luôn hiện */}
      <aside
        className="hidden md:flex md:h-full md:shrink-0 md:flex-col md:border-r md:border-black/20"
        style={{ width: 'var(--booking-sidebar-width)', background: 'var(--booking-sidebar)' }}
      >
        <SidebarContent user={user} />
      </aside>

      {/* Mobile/tablet hẹp: nút nổi mở ngăn kéo trái */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mở điều hướng Booking"
        className="fixed left-4 top-4 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--booking-sidebar)] text-white shadow-lg md:hidden"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex max-w-[85vw] flex-col shadow-2xl transition-transform duration-200 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 'var(--booking-sidebar-width)', background: 'var(--booking-sidebar)' }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Đóng"
          className="absolute right-2 top-2 text-[#9fb3aa] hover:text-white"
        >
          <X size={18} />
        </button>
        <SidebarContent user={user} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  )
}
