'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Download } from 'lucide-react'
import EmptyState from '@/components/booking/EmptyState'
import DatePicker from '@/components/ui/DatePicker'

type BookingRow = {
  user_id: string
  status: string
  start_at: string
  resource: { id: string; group_id: string; name: string; color: string } | null
}
type GroupRow = { id: string; name: string; icon: string }
type ResourceOption = { id: string; group_id: string; name: string }
type MemberOption = { id: string; full_name: string; department: string | null }

const STATUS_LABELS: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', cancelled: 'Đã hủy' }
const STATUS_TONE: Record<string, string> = { pending: 'warning', approved: 'success', rejected: 'danger', cancelled: 'neutral' }
const PIE_COLORS = ['#096AA7', '#60BB46', '#FFA726', '#E53935', '#8b5cf6', '#06b6d4', '#f97316']

function daysAgoStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}
function todayStr() { return new Date().toISOString().slice(0, 10) }

export default function BookingReportsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [groups, setGroups] = useState<GroupRow[]>([])
  const [resources, setResources] = useState<ResourceOption[]>([])
  const [members, setMembers] = useState<MemberOption[]>([])
  const [loading, setLoading] = useState(true)

  // Bộ lọc báo cáo (20/07/2026) — mặc định 30 ngày gần nhất như hành vi cũ.
  const [dateFrom, setDateFrom] = useState(() => daysAgoStr(30))
  const [dateTo, setDateTo] = useState(() => todayStr())
  const [groupFilter, setGroupFilter] = useState('')
  const [resourceFilter, setResourceFilter] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deptFilter, setDeptFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        from: new Date(`${dateFrom}T00:00:00`).toISOString(),
        to: new Date(`${dateTo}T23:59:59`).toISOString(),
      })
      if (resourceFilter) params.set('resource_id', resourceFilter)
      if (userFilter) params.set('user_id', userFilter)
      if (statusFilter) params.set('status', statusFilter)

      const [bRes, gRes, mRes] = await Promise.all([
        fetch(`/api/bookings?${params.toString()}`),
        fetch('/api/booking-resources'),
        fetch('/api/members'),
      ])
      setBookings((await bRes.json()).bookings ?? [])
      const groupsJson: (GroupRow & { resources: ResourceOption[] })[] = await gRes.json()
      setGroups(groupsJson.map((g) => ({ id: g.id, name: g.name, icon: g.icon })))
      setResources(groupsJson.flatMap((g) => g.resources.map((r) => ({ id: r.id, group_id: g.id, name: r.name }))))
      setMembers((await mRes.json()).map((u: { id: string; full_name: string; department?: string | null }) => ({ id: u.id, full_name: u.full_name, department: u.department ?? null })))
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, resourceFilter, userFilter, statusFilter])

  useEffect(() => { load() }, [load])

  const memberDept = useMemo(() => new Map(members.map((m) => [m.id, m.department])), [members])
  const departments = useMemo(() => Array.from(new Set(members.map((m) => m.department).filter((d): d is string => !!d))).sort(), [members])

  // Nhóm/tài nguyên lọc server-side đã áp dụng resourceFilter; groupFilter và
  // deptFilter lọc thêm ở client (groupFilter vì API chỉ nhận resource_id cụ
  // thể, deptFilter vì phòng ban không có field trực tiếp trên booking — xem
  // design.md Decision 1 của change booking-reports-export-polish).
  const filtered = bookings.filter((b) => {
    if (groupFilter && b.resource?.group_id !== groupFilter) return false
    if (deptFilter && memberDept.get(b.user_id) !== deptFilter) return false
    return true
  })

  const byStatus = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of filtered) map.set(b.status, (map.get(b.status) ?? 0) + 1)
    return Array.from(map.entries()).map(([status, total]) => ({ status, total }))
  }, [filtered])

  const byGroup = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of filtered) {
      const gid = b.resource?.group_id
      if (!gid) continue
      map.set(gid, (map.get(gid) ?? 0) + 1)
    }
    return groups.map((g) => ({ ...g, value: map.get(g.id) ?? 0 })).filter((g) => g.value > 0)
  }, [filtered, groups])

  const byResource = useMemo(() => {
    const map = new Map<string, { name: string; color: string; total: number }>()
    for (const b of filtered) {
      if (!b.resource) continue
      const cur = map.get(b.resource.id) ?? { name: b.resource.name, color: b.resource.color, total: 0 }
      cur.total += 1
      map.set(b.resource.id, cur)
    }
    return Array.from(map.values()).sort((a, z) => z.total - a.total).slice(0, 10)
  }, [filtered])

  const byMonth = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of filtered) {
      const m = b.start_at.slice(0, 7)
      map.set(m, (map.get(m) ?? 0) + 1)
    }
    return Array.from(map.entries()).sort(([a], [z]) => a.localeCompare(z))
  }, [filtered])

  const total = filtered.length

  function exportExcel() {
    const params = new URLSearchParams({
      from: new Date(`${dateFrom}T00:00:00`).toISOString(),
      to: new Date(`${dateTo}T23:59:59`).toISOString(),
    })
    if (resourceFilter) params.set('resource_id', resourceFilter)
    else if (groupFilter) params.set('group_id', groupFilter)
    if (userFilter) params.set('user_id', userFilter)
    if (statusFilter) params.set('status', statusFilter)
    if (deptFilter) {
      const ids = members.filter((m) => m.department === deptFilter).map((m) => m.id)
      params.set('user_ids', ids.join(','))
    }
    window.open(`/api/bookings/export?${params.toString()}`, '_blank')
  }

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6" style={{ color: 'var(--hp-text-primary)' }}>
      <Link href="/bookings" className="mb-3 inline-flex items-center gap-1 text-sm" style={{ color: 'var(--hp-text-desc)' }}>
        <ArrowLeft size={14} /> Quay lại Booking
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Báo cáo Booking</h1>
        <button onClick={exportExcel} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
          <Download size={14} /> Xuất Excel
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
        <div className="flex items-center gap-1.5">
          <DatePicker value={dateFrom} onChange={setDateFrom} className="hp-input w-auto text-left" />
          <span className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>đến</span>
          <DatePicker value={dateTo} onChange={setDateTo} className="hp-input w-auto text-left" />
        </div>
        <select value={groupFilter} onChange={(e) => { setGroupFilter(e.target.value); setResourceFilter('') }} className="hp-input w-auto">
          <option value="">Tất cả nhóm</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={resourceFilter} onChange={(e) => setResourceFilter(e.target.value)} className="hp-input w-auto">
          <option value="">Tất cả tài nguyên</option>
          {resources.filter((r) => !groupFilter || r.group_id === groupFilter).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} className="hp-input w-auto">
          <option value="">Tất cả người đặt</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="hp-input w-auto">
          <option value="">Tất cả phòng ban</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="hp-input w-auto">
          <option value="">Mọi trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--hp-text-desc)' }}>Đang tải...</div>
      ) : total === 0 ? (
        <EmptyState icon={BarChart3} title="Chưa có dữ liệu" description="Không có lượt đặt lịch nào khớp bộ lọc đang chọn." />
      ) : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            {byStatus.map((s) => (
              <div key={s.status} className="rounded-xl p-4" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
                <div className="text-2xl font-bold" style={{ color: `var(--hp-${STATUS_TONE[s.status] ?? 'neutral'}-soft)` }}>{s.total}</div>
                <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>{STATUS_LABELS[s.status] ?? s.status}</div>
              </div>
            ))}
          </div>

          <div className="mb-5 grid gap-5 md:grid-cols-2">
            <Card title="Tỉ lệ theo nhóm tài nguyên">
              <PieChart data={byGroup.map((g, i) => ({ label: g.name, value: g.value, color: PIE_COLORS[i % PIE_COLORS.length] }))} />
            </Card>
            <Card title="Theo trạng thái">
              {byStatus.map((s) => {
                const pct = total > 0 ? Math.round((s.total / total) * 100) : 0
                const tone = STATUS_TONE[s.status] ?? 'neutral'
                return (
                  <div key={s.status} className="mb-3">
                    <div className="mb-1 flex justify-between text-xs">
                      <span style={{ color: `var(--hp-${tone}-soft)` }}>{STATUS_LABELS[s.status] ?? s.status}</span>
                      <span style={{ color: 'var(--hp-text-desc)' }}>{s.total} ({pct}%)</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--hp-divider)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `var(--hp-${tone})` }} />
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>

          <Card title="Theo tài nguyên (top 10)" className="mb-5">
            <div className="grid gap-x-8 sm:grid-cols-2">
              {byResource.map((r) => {
                const max = Math.max(...byResource.map((x) => x.total), 1)
                const pct = Math.round((r.total / max) * 100)
                return (
                  <div key={r.name} className="mb-2.5">
                    <div className="mb-1 flex justify-between text-xs"><span>{r.name}</span><span>{r.total}</span></div>
                    <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--hp-divider)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: r.color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card title="Xu hướng theo tháng">
            <div className="flex items-end gap-3" style={{ height: 140 }}>
              {byMonth.map(([month, count]) => {
                const max = Math.max(...byMonth.map(([, c]) => c), 1)
                const h = Math.round((count / max) * 100)
                return (
                  <div key={month} className="flex flex-1 flex-col items-center">
                    <div className="mb-1 text-xs">{count}</div>
                    <div className="w-full rounded-t" style={{ height: `${h}%`, minHeight: 4, background: 'var(--hp-primary)' }} />
                    <div className="mt-1 text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>{month.slice(5)}</div>
                  </div>
                )
              })}
            </div>
          </Card>
        </>
      )}

      <style jsx global>{`
        .hp-input { padding: 6px 10px; border: 1px solid var(--hp-border); border-radius: 8px; font-size: 13px; outline: none; background: var(--hp-card); color: var(--hp-text-primary); }
      `}</style>
    </div>
  )
}

function Card({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`} style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
      <h3 className="mb-4 text-sm font-bold" style={{ color: 'var(--hp-text-primary)' }}>{title}</h3>
      {children}
    </div>
  )
}

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <div className="py-8 text-center text-sm" style={{ color: 'var(--hp-text-desc)' }}>Chưa có dữ liệu</div>
  const cx = 100, cy = 100, r = 80
  type Slice = { d: (typeof data)[number]; x1: number; y1: number; x2: number; y2: number; large: number; pct: number; endAngle: number }
  const slices = data.reduce<Slice[]>((acc, d) => {
    const startAngle = acc.length === 0 ? -Math.PI / 2 : acc[acc.length - 1].endAngle
    const a = (d.value / total) * 2 * Math.PI
    const endAngle = startAngle + a
    const x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle)
    return [...acc, { d, x1, y1, x2, y2, large: a > Math.PI ? 1 : 0, pct: Math.round((d.value / total) * 100), endAngle }]
  }, [])

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 200 200" width={160} height={160}>
        {slices.map((s, i) => (
          <path key={i} d={`M${cx},${cy} L${s.x1},${s.y1} A${r},${r} 0 ${s.large},1 ${s.x2},${s.y2} Z`} fill={s.d.color} stroke="var(--hp-card)" strokeWidth={2} />
        ))}
        <circle cx={cx} cy={cy} r={36} fill="var(--hp-card)" />
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={22} fontWeight={700} fill="var(--hp-text-primary)">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={10} fill="var(--hp-text-desc)">tổng</text>
      </svg>
      <div className="flex-1 space-y-2">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 shrink-0 rounded" style={{ background: s.d.color }} />
            <span className="flex-1" style={{ color: 'var(--hp-text-secondary)' }}>{s.d.label}</span>
            <span className="font-semibold">{s.d.value}</span>
            <span className="min-w-[36px]" style={{ color: 'var(--hp-text-desc)' }}>({s.pct}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
