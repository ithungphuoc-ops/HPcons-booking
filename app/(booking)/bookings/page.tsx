'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeSearch } from '@/components/ui/HighlightMatch'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Clock3, CalendarClock, Star, Target, BarChart3, Settings2, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import ThemeToggle from '@/components/booking/ThemeToggle'
import KpiCard from '@/components/booking/KpiCard'
import BookingFormDialog, { type BookingGroupOption, type BookingResourceOption, type MemberOption, type BookingPurposeOption, type EditableBooking } from '@/components/booking/BookingFormDialog'
import BookingDetailDialog, { type BookingDetail } from '@/components/booking/BookingDetailDialog'
import ManageResourcesPanel from '@/components/booking/ManageResourcesPanel'
import MonthCalendar, { getMonthGridRange } from '@/components/booking/MonthCalendar'
import WeekCalendar, { getWeekStart, getWeekRange } from '@/components/booking/WeekCalendar'
import DayCalendar, { getDayRange } from '@/components/booking/DayCalendar'
import QuickBookModal from '@/components/booking/QuickBookModal'

type ViewMode = 'month' | 'week' | 'day'

type BookingListItem = {
  id: string
  resource_id: string
  user_id: string
  title: string
  purpose_name: string | null
  start_at: string
  end_at: string
  status: string
  resource: { id: string; group_id: string; name: string; color: string } | null
  user: { full_name: string; email: string; department?: string | null } | null
  followers: { id: string; name: string }[]
  approvals: { approver_id: string; level: number; status: string }[]
}

type GroupWithResources = BookingGroupOption & { description: string | null; resources: BookingResourceOption[] }

// "Tất cả" (mặc định) thay cho "Lịch đã duyệt" cũ (20/07/2026) — gộp cả
// pending + approved, hiển thị cho MỌI nhân viên để tránh 2 phòng ban đặt
// trùng giờ mà không biết tài nguyên đã có người giữ chỗ (dù đang chờ duyệt).
// Thứ tự tab phỏng theo booking.base.vn: Của tôi, Theo dõi, Chờ duyệt, Tất cả.
const TABS = [
  { key: 'mine', label: 'Của tôi' },
  { key: 'following', label: 'Theo dõi' },
  { key: 'sent_to_me', label: 'Chờ duyệt' },
  { key: 'all', label: 'Tất cả' },
] as const
type TabKey = typeof TABS[number]['key']

export default function BookingsPage() {
  return (
    <Suspense fallback={null}>
      <BookingsPageInner />
    </Suspense>
  )
}

function BookingsPageInner() {
  const searchParams = useSearchParams()
  const [groups, setGroups] = useState<GroupWithResources[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [purposes, setPurposes] = useState<BookingPurposeOption[]>([])
  const [bookings, setBookings] = useState<BookingListItem[]>([])
  const [isApprover, setIsApprover] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<TabKey>('all')
  const [groupFilter, setGroupFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingBooking, setEditingBooking] = useState<EditableBooking | null>(null)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)

  // Lịch: viewMode = Tháng/Tuần/Ngày (20/07/2026). viewMonth = tháng đang xem
  // (chế độ Tháng), anchorDate = ngày mốc đang xem (chế độ Tuần/Ngày).
  // pickerDate = ngày vừa bấm trên lịch (mở QuickBookModal), quickPrefill =
  // tài nguyên+giờ đã chọn qua modal nhanh để điền sẵn vào BookingFormDialog.
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [quickPrefill, setQuickPrefill] = useState<{ resourceId: string; slot: { start: string; end: string } } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { from, to } = viewMode === 'month' ? getMonthGridRange(viewMonth)
        : viewMode === 'week' ? getWeekRange(anchorDate)
        : getDayRange(anchorDate)
      const bookingsUrl = `/api/bookings?from=${from.toISOString()}&to=${to.toISOString()}`
      const [bRes, gRes, mRes, pRes] = await Promise.all([
        fetch(bookingsUrl),
        fetch('/api/booking-resources'),
        fetch('/api/members'),
        fetch('/api/booking-purposes'),
      ])
      const bJson = await bRes.json()
      setBookings(bJson.bookings ?? [])
      setIsApprover(bJson.isApprover ?? false)
      setIsAdmin(bJson.isAdmin ?? false)
      setMyUserId(bJson.myUserId ?? '')
      setGroups(await gRes.json())
      // Giữ nguyên username khi map — thiếu nó khiến @ tìm chỉ khớp được theo tên đầy đủ CÓ DẤU,
      // gõ không dấu (vd "hau") sẽ không khớp "Hậu" (30/07/2026, phát hiện lúc test picker quản
      // lý trực tiếp mới thêm ở BookingFormDialog.tsx).
      setMembers((await mRes.json()).map((u: { id: string; full_name: string; username?: string | null; department?: string | null }) => ({ id: u.id, full_name: u.full_name, username: u.username, department: u.department })))
      setPurposes(await pRes.json())
    } finally {
      // Luôn tắt loading dù có lỗi giữa chừng (vd 1 fetch lỗi) — tránh trang
      // bị kẹt loading vĩnh viễn như sự cố 21/07/2026 (thiếu composite index
      // ở /api/booking-purposes làm nhân viên không xem được lịch).
      setLoading(false)
    }
  }, [viewMonth, viewMode, anchorDate])

  useEffect(() => { load() }, [load])

  // Đến từ sidebar Booking: ?group=<id> lọc sẵn theo nhóm, ?new=1 mở nhanh form
  // tạo đăng ký (xem components/booking/BookingSidebar.tsx). ?open=<id> đến từ
  // link thông báo duyệt (notifyBookingApprover) — tự mở chi tiết booking đó.
  useEffect(() => {
    const group = searchParams.get('group')
    if (group) setGroupFilter(group)
    if (searchParams.get('new') === '1') setShowForm(true)
    const open = searchParams.get('open')
    if (open) setSelectedBookingId(open)
  }, [searchParams])

  const resources = useMemo(() => groups.flatMap((g) => g.resources), [groups])
  // "Quản lý tài nguyên" (per-resource, không phải admin toàn cục, 20/07/2026)
  // — cũng được thấy nút "Quản lý tài nguyên" nếu đang quản lý ít nhất 1 tài
  // nguyên, dù bản thân không phải admin.
  const isResourceManagerOfAny = useMemo(() => resources.some((r) => r.manager_id === myUserId), [resources, myUserId])

  const mine = useMemo(() => bookings.filter((b) => b.user_id === myUserId), [bookings, myUserId])
  const following = useMemo(() => bookings.filter((b) => b.followers.some((f) => f.id === myUserId)), [bookings, myUserId])
  const sentToMe = useMemo(() => bookings.filter((b) => b.approvals.some((a) => a.approver_id === myUserId && a.status === 'pending')), [bookings, myUserId])
  const approved = useMemo(() => bookings.filter((b) => b.status === 'approved'), [bookings])
  // "Tất cả" = pending + approved (loại rejected/cancelled — không còn chiếm
  // giờ tài nguyên nữa) — xem tab "all" ở trên.
  const allActive = useMemo(() => bookings.filter((b) => b.status === 'pending' || b.status === 'approved'), [bookings])
  const thisWeekApproved = useMemo(() => {
    const now = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(start.getDate() + 7)
    return approved.filter((b) => { const s = new Date(b.start_at); return s >= start && s < end })
  }, [approved])

  const tabRows: Record<TabKey, BookingListItem[]> = { sent_to_me: sentToMe, all: allActive, mine, following }
  let shown = tabRows[tab]
  if (groupFilter) shown = shown.filter((b) => b.resource?.group_id === groupFilter)
  if (searchQuery.trim()) {
    const q = normalizeSearch(searchQuery.trim())
    shown = shown.filter((b) =>
      normalizeSearch(b.title).includes(q) ||
      (b.resource ? normalizeSearch(b.resource.name).includes(q) : false) ||
      (b.user ? normalizeSearch(b.user.full_name).includes(q) : false) ||
      (b.user?.department ? normalizeSearch(b.user.department).includes(q) : false),
    )
  }

  function prevPeriod() {
    if (viewMode === 'month') setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
    else if (viewMode === 'week') setAnchorDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 7); return n })
    else setAnchorDate((d) => { const n = new Date(d); n.setDate(n.getDate() - 1); return n })
  }
  function nextPeriod() {
    if (viewMode === 'month') setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
    else if (viewMode === 'week') setAnchorDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 7); return n })
    else setAnchorDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
  }
  function goToday() {
    const n = new Date()
    setViewMonth(new Date(n.getFullYear(), n.getMonth(), 1))
    setAnchorDate(n)
  }

  function handleResourcePicked(resourceId: string) {
    if (!pickerDate) return
    setQuickPrefill({ resourceId, slot: { start: `${pickerDate}T08:00`, end: `${pickerDate}T09:00` } })
    setPickerDate(null)
    setShowForm(true)
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6" style={{ color: 'var(--hp-text-primary)' }}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Booking</h1>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--hp-text-desc)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm đăng ký..."
              className="hp-input w-auto py-2 pl-8"
            />
          </div>
          <Link href="/bookings/purposes" className="hp-btn-ghost"><Target size={14} /> Mục đích</Link>
          <Link href="/bookings/reports" className="hp-btn-ghost"><BarChart3 size={14} /> Báo cáo</Link>
          {(isAdmin || isResourceManagerOfAny) && (
            <button onClick={() => setShowManage((v) => !v)} className="hp-btn-ghost"><Settings2 size={14} /> Quản lý tài nguyên</button>
          )}
          <button onClick={load} className="hp-btn-ghost"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <ThemeToggle />
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
            <Plus size={15} /> Đặt lịch
          </button>
        </div>
      </div>

      {(isAdmin || isResourceManagerOfAny) && showManage && (
        <div className="mb-5">
          <ManageResourcesPanel groups={groups} members={members} onChanged={load} isAdmin={isAdmin} myUserId={myUserId} />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Clock3} title="Chờ duyệt (của tôi)" value={sentToMe.length} sub="cần xử lý" tone="warning" />
        <KpiCard icon={CalendarClock} title="Của tôi" value={mine.length} sub="lượt đặt gần đây" tone="primary" />
        <KpiCard icon={CalendarClock} title="Tuần này" value={thisWeekApproved.length} sub="lượt đã duyệt" tone="success" />
        <KpiCard icon={Star} title="Theo dõi" value={following.length} sub="đang theo dõi" tone="neutral" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl p-2" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
        {TABS.filter((t) => t.key !== 'sent_to_me' || isApprover).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="rounded-lg px-3.5 py-1.5 text-sm font-semibold"
            style={tab === t.key ? { background: 'var(--hp-primary)', color: '#fff' } : { color: 'var(--hp-text-secondary)' }}>
            {t.label} {t.key === 'sent_to_me' && sentToMe.length > 0 ? `(${sentToMe.length})` : ''}
          </button>
        ))}
        <div className="flex-1" />
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="hp-input w-auto">
          <option value="">Tất cả nhóm</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button onClick={prevPeriod} className="hp-btn-ghost" style={{ padding: '8px' }}><ChevronLeft size={16} /></button>
        <span className="min-w-[140px] text-center text-sm font-bold">
          {viewMode === 'month' && `Tháng ${viewMonth.getMonth() + 1}, ${viewMonth.getFullYear()}`}
          {viewMode === 'week' && (() => { const { from, to } = getWeekRange(anchorDate); const last = new Date(to); last.setDate(last.getDate() - 1); return `${getWeekStart(anchorDate).toLocaleDateString('vi-VN')} – ${last.toLocaleDateString('vi-VN')}` })()}
          {viewMode === 'day' && anchorDate.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
        <button onClick={nextPeriod} className="hp-btn-ghost" style={{ padding: '8px' }}><ChevronRight size={16} /></button>
        <button onClick={goToday} className="hp-btn-ghost">Hôm nay</button>
        <div className="ml-auto flex gap-1 rounded-lg p-1" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
          {(['month', 'week', 'day'] as ViewMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className="rounded-md px-3 py-1 text-xs font-semibold"
              style={viewMode === m ? { background: 'var(--hp-primary)', color: '#fff' } : { color: 'var(--hp-text-secondary)' }}
            >
              {m === 'month' ? 'Tháng' : m === 'week' ? 'Tuần' : 'Ngày'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-[420px] animate-pulse rounded-xl" style={{ background: 'var(--hp-surface)' }} />
      ) : viewMode === 'month' ? (
        <MonthCalendar
          month={viewMonth}
          bookings={shown}
          onDayClick={(dateStr) => setPickerDate(dateStr)}
          onBookingClick={setSelectedBookingId}
        />
      ) : viewMode === 'week' ? (
        <WeekCalendar
          weekStart={getWeekStart(anchorDate)}
          bookings={shown}
          onDayClick={(dateStr) => setPickerDate(dateStr)}
          onBookingClick={setSelectedBookingId}
        />
      ) : (
        <DayCalendar
          day={anchorDate}
          bookings={shown}
          onAddClick={() => setPickerDate(anchorDate.toISOString().slice(0, 10))}
          onBookingClick={setSelectedBookingId}
        />
      )}

      {(showForm || editingBooking) && (
        <BookingFormDialog
          groups={groups}
          resources={resources}
          members={members}
          purposes={purposes}
          initialResourceId={quickPrefill?.resourceId}
          initialSlot={quickPrefill?.slot ?? null}
          editingBooking={editingBooking}
          onClose={() => { setShowForm(false); setQuickPrefill(null); setEditingBooking(null) }}
          onSaved={() => { setShowForm(false); setQuickPrefill(null); setEditingBooking(null); load() }}
        />
      )}
      {selectedBookingId && (
        <BookingDetailDialog
          bookingId={selectedBookingId}
          myUserId={myUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedBookingId(null)}
          onUpdated={load}
          onEdit={(detail: BookingDetail) => {
            setEditingBooking({
              id: detail.id,
              resource_id: detail.resource_id,
              title: detail.title,
              purpose_id: detail.purpose_id,
              purpose_text: detail.purpose_id ? null : detail.purpose_name,
              form_data: detail.form_data,
              note: detail.note,
              destination: detail.destination,
              passengers: detail.passengers,
              quantity: detail.quantity,
              start_at: detail.start_at,
              end_at: detail.end_at,
            })
            setSelectedBookingId(null)
          }}
        />
      )}
      {pickerDate && (
        <QuickBookModal
          groups={groups}
          dateStr={pickerDate}
          onClose={() => setPickerDate(null)}
          onPicked={handleResourcePicked}
        />
      )}

      <style jsx global>{`
        .hp-input { padding: 6px 10px; border: 1px solid var(--hp-border); border-radius: 8px; font-size: 13px; outline: none; background: var(--hp-card); color: var(--hp-text-primary); }
        .hp-btn-ghost { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--hp-text-secondary); border: 1px solid var(--hp-border); background: var(--hp-card); }
      `}</style>
    </div>
  )
}
