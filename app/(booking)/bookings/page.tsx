'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Plus, RefreshCw, Clock3, CalendarClock, Star, Target, BarChart3, Settings2, ChevronLeft, ChevronRight } from 'lucide-react'
import KpiCard from '@/components/booking/KpiCard'
import BookingFormDialog, { type BookingGroupOption, type BookingResourceOption, type MemberOption } from '@/components/booking/BookingFormDialog'
import BookingDetailDialog from '@/components/booking/BookingDetailDialog'
import ManageResourcesPanel from '@/components/booking/ManageResourcesPanel'
import MonthCalendar, { getMonthGridRange } from '@/components/booking/MonthCalendar'
import QuickBookModal from '@/components/booking/QuickBookModal'

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
  user: { full_name: string; email: string } | null
  followers: { id: string; name: string }[]
  approvals: { approver_id: string; level: number; status: string }[]
}

type GroupWithResources = BookingGroupOption & { description: string | null; resources: BookingResourceOption[] }

const TABS = [
  { key: 'sent_to_me', label: 'Chờ duyệt' },
  { key: 'schedule', label: 'Lịch đã duyệt' },
  { key: 'mine', label: 'Của tôi' },
  { key: 'following', label: 'Theo dõi' },
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
  const [bookings, setBookings] = useState<BookingListItem[]>([])
  const [isApprover, setIsApprover] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [myUserId, setMyUserId] = useState('')
  const [loading, setLoading] = useState(true)

  const [tab, setTab] = useState<TabKey>('schedule')
  const [groupFilter, setGroupFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [showManage, setShowManage] = useState(false)

  // Lịch tháng thật ở Home: viewMonth = tháng đang xem, pickerDate = ngày vừa
  // bấm trên lịch (mở QuickBookModal), quickPrefill = tài nguyên+giờ đã chọn
  // qua modal nhanh để điền sẵn vào BookingFormDialog.
  const [viewMonth, setViewMonth] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1) })
  const [pickerDate, setPickerDate] = useState<string | null>(null)
  const [quickPrefill, setQuickPrefill] = useState<{ resourceId: string; slot: { start: string; end: string } } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = getMonthGridRange(viewMonth)
    const bookingsUrl = `/api/bookings?from=${from.toISOString()}&to=${to.toISOString()}`
    const [bRes, gRes, mRes] = await Promise.all([
      fetch(bookingsUrl),
      fetch('/api/booking-resources'),
      fetch('/api/members'),
    ])
    const bJson = await bRes.json()
    setBookings(bJson.bookings ?? [])
    setIsApprover(bJson.isApprover ?? false)
    setIsAdmin(bJson.isAdmin ?? false)
    setMyUserId(bJson.myUserId ?? '')
    setGroups(await gRes.json())
    setMembers((await mRes.json()).map((u: { id: string; full_name: string; department?: string | null }) => ({ id: u.id, full_name: u.full_name, department: u.department })))
    setLoading(false)
  }, [viewMonth])

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

  const mine = useMemo(() => bookings.filter((b) => b.user_id === myUserId), [bookings, myUserId])
  const following = useMemo(() => bookings.filter((b) => b.followers.some((f) => f.id === myUserId)), [bookings, myUserId])
  const sentToMe = useMemo(() => bookings.filter((b) => b.approvals.some((a) => a.approver_id === myUserId && a.status === 'pending')), [bookings, myUserId])
  const approved = useMemo(() => bookings.filter((b) => b.status === 'approved'), [bookings])
  const thisWeekApproved = useMemo(() => {
    const now = new Date()
    const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(start.getDate() + 7)
    return approved.filter((b) => { const s = new Date(b.start_at); return s >= start && s < end })
  }, [approved])

  const tabRows: Record<TabKey, BookingListItem[]> = { sent_to_me: sentToMe, schedule: approved, mine, following }
  let shown = tabRows[tab]
  if (groupFilter) shown = shown.filter((b) => b.resource?.group_id === groupFilter)

  function prevMonth() { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)) }
  function nextMonth() { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)) }
  function goToday() { const n = new Date(); setViewMonth(new Date(n.getFullYear(), n.getMonth(), 1)) }

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
          <Link href="/bookings/purposes" className="hp-btn-ghost"><Target size={14} /> Mục đích</Link>
          <Link href="/bookings/reports" className="hp-btn-ghost"><BarChart3 size={14} /> Báo cáo</Link>
          {isAdmin && (
            <button onClick={() => setShowManage((v) => !v)} className="hp-btn-ghost"><Settings2 size={14} /> Quản lý tài nguyên</button>
          )}
          <button onClick={load} className="hp-btn-ghost"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
            <Plus size={15} /> Đặt lịch
          </button>
        </div>
      </div>

      {isAdmin && showManage && (
        <div className="mb-5">
          <ManageResourcesPanel groups={groups} members={members} onChanged={load} />
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

      <div className="mb-3 flex items-center gap-2">
        <button onClick={prevMonth} className="hp-btn-ghost" style={{ padding: '8px' }}><ChevronLeft size={16} /></button>
        <span className="min-w-[140px] text-center text-sm font-bold">Tháng {viewMonth.getMonth() + 1}, {viewMonth.getFullYear()}</span>
        <button onClick={nextMonth} className="hp-btn-ghost" style={{ padding: '8px' }}><ChevronRight size={16} /></button>
        <button onClick={goToday} className="hp-btn-ghost">Hôm nay</button>
      </div>

      {loading ? (
        <div className="h-[420px] animate-pulse rounded-xl" style={{ background: 'var(--hp-surface)' }} />
      ) : (
        <MonthCalendar
          month={viewMonth}
          bookings={shown}
          onDayClick={(dateStr) => setPickerDate(dateStr)}
          onBookingClick={setSelectedBookingId}
        />
      )}

      {showForm && (
        <BookingFormDialog
          groups={groups}
          resources={resources}
          members={members}
          initialResourceId={quickPrefill?.resourceId}
          initialSlot={quickPrefill?.slot ?? null}
          onClose={() => { setShowForm(false); setQuickPrefill(null) }}
          onSaved={() => { setShowForm(false); setQuickPrefill(null); load() }}
        />
      )}
      {selectedBookingId && (
        <BookingDetailDialog
          bookingId={selectedBookingId}
          myUserId={myUserId}
          isAdmin={isAdmin}
          onClose={() => setSelectedBookingId(null)}
          onUpdated={load}
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
