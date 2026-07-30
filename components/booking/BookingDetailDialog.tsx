'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Star, MapPin, Users2, Target, FileText, ShieldCheck, Paperclip } from 'lucide-react'
import StatusBadge from './StatusBadge'
import ApprovalStatusDot from './ApprovalStatusDot'
import TimelineProgress from './TimelineProgress'
import CommentThread from '@/components/comments/CommentThread'
import type { MentionOption } from '@/components/comments/CommentComposer'

export type BookingDetail = {
  id: string
  user_id: string
  resource_id: string
  title: string
  purpose_id: string | null
  purpose_name: string | null
  note: string | null
  destination: string | null
  passengers: string | null
  quantity: number | null
  start_at: string
  end_at: string
  status: string
  resource: { name: string; description?: string | null; manager_name?: string | null; followers?: { id: string; name: string }[] } | null
  user: { full_name: string; email: string; department?: string | null } | null
  followers: { id: string; name: string; title?: string | null }[]
  attachments?: { name: string; url: string }[]
  form_data?: { fieldId: string; label: string; type: string; value: unknown }[]
  approvals: { approver_id: string; approver_name: string; approver_title?: string | null; level: number; status: string; note: string | null }[]
  logs: { user_id: string; actor_name: string; action: string; created_at: string }[]
}

export default function BookingDetailDialog({
  bookingId,
  myUserId,
  isAdmin,
  onClose,
  onUpdated,
  onEdit,
}: {
  bookingId: string
  myUserId: string
  isAdmin?: boolean
  onClose: () => void
  onUpdated: () => void
  onEdit?: (detail: BookingDetail) => void
}) {
  const [detail, setDetail] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [error, setError] = useState('')
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [mentionPeople, setMentionPeople] = useState<MentionOption[]>([])
  const [mentionGroups, setMentionGroups] = useState<MentionOption[]>([])
  const loadedAt = useMemo(() => new Date(), [])

  // Danh sách gợi ý @mention cho khung bình luận — người từ /api/members,
  // nhóm/phòng ban từ /api/member-groups + /api/units (đều đã có sẵn).
  useEffect(() => {
    Promise.all([
      fetch('/api/members').then((r) => r.json()).catch(() => []),
      fetch('/api/member-groups').then((r) => r.json()).catch(() => ({ groups: [] })),
      fetch('/api/units').then((r) => r.json()).catch(() => ({ units: [] })),
    ]).then(([members, mgRes, unitsRes]) => {
      setMentionPeople((Array.isArray(members) ? members : []).map((m: { id: string; full_name: string }) => ({ id: m.id, display: m.full_name })))
      const groupOpts = (mgRes.groups ?? []).map((g: { id: string; name: string }) => ({ id: g.id, display: g.name }))
      const unitOpts = (unitsRes.units ?? []).map((u: { id: string; name: string }) => ({ id: u.id, display: u.name }))
      setMentionGroups([...groupOpts, ...unitOpts])
    })
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/bookings/${bookingId}`)
    if (res.ok) setDetail(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [bookingId])

  async function act(action: 'approve' | 'reject', note?: string) {
    setBusy(true); setError('')
    try {
      const res = await fetch(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, note: note ?? null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Lỗi'); return }
      setShowReject(false)
      await load(); onUpdated()
    } finally { setBusy(false) }
  }

  async function toggleFollow() {
    await fetch(`/api/bookings/${bookingId}/follow`, { method: 'POST' })
    await load(); onUpdated()
  }

  async function cancel() {
    if (!confirm('Hủy lịch đặt này?')) return
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' })
    if (!res.ok) { const j = await res.json(); alert(j.error ?? 'Lỗi'); return }
    onUpdated(); onClose()
  }

  const d = detail
  const isFollowing = !!d?.followers.some((f) => f.id === myUserId)
  const myPendingApproval = d?.approvals.find((a) => a.approver_id === myUserId && a.status === 'pending')
  const currentApprover = d?.approvals.find((a) => a.status === 'pending')
  const fmtDate = (s: string) => new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div onClick={(e) => e.stopPropagation()} className="flex h-[85vh] w-[780px] max-w-[96vw] flex-col overflow-hidden rounded-2xl"
        style={{ background: 'var(--hp-card)', boxShadow: '0 24px 80px rgba(0,0,0,0.2)' }}>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--hp-divider)' }}>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="truncate text-base font-bold" style={{ color: 'var(--hp-text-primary)' }}>{d?.title ?? 'Chi tiết đặt lịch'}</span>
            {d && <StatusBadge status={d.status} />}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {d && (
              <button onClick={toggleFollow} className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: isFollowing ? 'var(--hp-warning)' : 'var(--hp-border)', color: isFollowing ? 'var(--hp-warning-soft)' : 'var(--hp-text-desc)' }}>
                <Star size={13} fill={isFollowing ? 'currentColor' : 'none'} /> {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
              </button>
            )}
            <button onClick={onClose} style={{ color: 'var(--hp-text-desc)' }}><X size={20} /></button>
          </div>
        </div>

        {loading && <div className="flex-1 p-5 text-sm" style={{ color: 'var(--hp-text-desc)' }}>Đang tải...</div>}

        {d && !loading && (
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 space-y-5 overflow-y-auto p-5" style={{ borderRight: '1px solid var(--hp-divider)' }}>
              {d.status === 'pending' && currentApprover && (
                <div className="flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium" style={{ background: 'var(--hp-success-bg)', color: 'var(--hp-success-soft)' }}>
                  <ShieldCheck size={16} className="shrink-0" />
                  Chờ duyệt bởi: <b>{currentApprover.approver_name}</b>
                </div>
              )}

              {d.status === 'approved' && (
                <Section title="THỜI GIAN">
                  <TimelineProgress startAt={new Date(d.start_at)} endAt={new Date(d.end_at)} />
                </Section>
              )}

              <Section title="THÔNG TIN">
                <InfoRow
                  icon={<Users2 size={14} />}
                  label="Người tạo"
                  value={d.user?.department ? `${d.user.full_name} · ${d.user.department}` : d.user?.full_name}
                />
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>Bắt đầu</div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--hp-warning-soft)' }}>{fmtDate(d.start_at)}</div>
                  </div>
                  <div>
                    <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>Kết thúc</div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--hp-warning-soft)' }}>{fmtDate(d.end_at)}</div>
                  </div>
                </div>
                {d.note && <InfoRow icon={<FileText size={14} />} label="Mô tả" value={d.note} multiline />}
                {d.attachments && d.attachments.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {d.attachments.map((a) => (
                      <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:opacity-80" style={{ background: 'var(--hp-neutral-bg)', color: 'var(--hp-text-primary)' }}>
                        <Paperclip size={12} className="shrink-0" /> <span className="truncate">{a.name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </Section>

              {(d.purpose_name || d.destination || d.passengers || d.quantity || (d.form_data && d.form_data.length > 0)) && (
                <Section title={`MỤC ĐÍCH${d.resource ? ' — ' + d.resource.name.toUpperCase() : ''}`}>
                  {d.purpose_name && <InfoRow icon={<Target size={14} />} label="Chi tiết mục đích" value={d.purpose_name} />}
                  {d.quantity != null && <InfoRow icon={<Users2 size={14} />} label="Số lượng" value={String(d.quantity)} />}
                  {/* Nhãn "Điểm đi"/"Điểm đến" NGƯỢC với tên field destination/passengers — xem
                      chú thích ở BookingFormDialog.tsx. */}
                  {d.destination && <InfoRow icon={<MapPin size={14} />} label="Điểm đi" value={d.destination} />}
                  {d.passengers && <InfoRow icon={<MapPin size={14} />} label="Điểm đến" value={d.passengers} />}
                  {d.form_data?.map((f) => {
                    if (f.type === 'file' && f.value && typeof f.value === 'object') {
                      const fileVal = f.value as { name: string; url: string }
                      return (
                        <InfoRow key={f.fieldId} icon={<Paperclip size={14} />} label={f.label} value={
                          <a href={fileVal.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--hp-primary)' }}>{fileVal.name}</a>
                        } />
                      )
                    }
                    const display = Array.isArray(f.value) ? f.value.join(', ') : typeof f.value === 'boolean' ? (f.value ? 'Có' : 'Không') : String(f.value ?? '')
                    return <InfoRow key={f.fieldId} icon={<Target size={14} />} label={f.label} value={display} />
                  })}
                </Section>
              )}

              {d.followers.length > 0 && (
                <Section title="NGƯỜI THEO DÕI">
                  <div className="flex flex-col gap-2">
                    {d.followers.map((f) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <Avatar name={f.name} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium" style={{ color: 'var(--hp-text-primary)' }}>{f.name}</div>
                          {f.title && <div className="truncate text-xs" style={{ color: 'var(--hp-text-desc)' }}>{f.title}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {error && <div className="rounded-lg px-3.5 py-2 text-sm" style={{ background: 'var(--hp-danger-bg)', color: 'var(--hp-danger-soft)' }}>{error}</div>}

              {(myPendingApproval || d.status === 'pending') && myPendingApproval && (
                <Section title="HÀNH ĐỘNG">
                  {!showReject ? (
                    <div className="flex gap-2.5">
                      <button onClick={() => act('approve')} disabled={busy} className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'var(--hp-success)' }}>Duyệt</button>
                      <button onClick={() => setShowReject(true)} disabled={busy} className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'var(--hp-danger)' }}>Từ chối</button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} placeholder="Lý do từ chối..." className="hp-input min-h-[70px] w-full" />
                      <div className="flex gap-2">
                        <button onClick={() => setShowReject(false)} className="rounded-lg px-4 py-2 text-sm" style={{ border: '1px solid var(--hp-border)' }}>Hủy</button>
                        <button onClick={() => act('reject', rejectNote)} disabled={busy} className="flex-1 rounded-lg py-2 text-sm font-bold text-white" style={{ background: 'var(--hp-danger)' }}>Xác nhận từ chối</button>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {(d.status === 'pending' || d.status === 'approved') && new Date(d.start_at) > loadedAt && (d.user_id === myUserId || isAdmin) && (
                <div className="flex gap-3">
                  {onEdit && <button onClick={() => onEdit(d)} className="text-xs font-medium" style={{ color: 'var(--hp-primary)' }}>Sửa đăng ký</button>}
                  {d.user_id === myUserId && (
                    <button onClick={cancel} className="text-xs font-medium" style={{ color: 'var(--hp-danger)' }}>Hủy đặt lịch này</button>
                  )}
                </div>
              )}

              <Section title="BÌNH LUẬN">
                <CommentThread
                  entityType="booking"
                  entityId={bookingId}
                  myUserId={myUserId}
                  isAdmin={!!isAdmin}
                  people={mentionPeople}
                  groups={mentionGroups}
                />
              </Section>
            </div>

            <div className="w-[260px] shrink-0 space-y-5 overflow-y-auto p-4" style={{ background: 'var(--hp-surface)' }}>
              <Section title="NGƯỜI DUYỆT">
                {d.approvals.length === 0 && <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>Tự động duyệt — không cần người duyệt</div>}
                {d.approvals.map((a) => (
                  <div key={a.approver_id + a.level} className="mb-2.5 flex items-center gap-2">
                    <Avatar name={a.approver_name} size={30} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold" style={{ color: 'var(--hp-text-primary)' }}>{a.approver_name}</div>
                      {a.approver_title && <div className="truncate text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>{a.approver_title}</div>}
                    </div>
                    <ApprovalStatusDot status={a.status} />
                  </div>
                ))}
              </Section>

              {d.resource && (d.resource.manager_name || (d.resource.followers && d.resource.followers.length > 0) || d.resource.description) && (
                <Section title="THÔNG TIN CỦA TÀI NGUYÊN">
                  <div className="mb-1.5 text-xs font-semibold" style={{ color: 'var(--hp-text-primary)' }}>{d.resource.name}</div>
                  {d.resource.manager_name && (
                    <div className="mb-1.5 text-xs">
                      <span style={{ color: 'var(--hp-text-desc)' }}>Người quản lý: </span>
                      <span style={{ color: 'var(--hp-text-primary)' }}>{d.resource.manager_name}</span>
                    </div>
                  )}
                  {d.resource.followers && d.resource.followers.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {d.resource.followers.map((f) => <Avatar key={f.id} name={f.name} size={22} />)}
                    </div>
                  )}
                  {d.resource.description && (
                    <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>{d.resource.description}</div>
                  )}
                </Section>
              )}

              <Section title="LỊCH SỬ">
                {(showAllLogs ? d.logs : d.logs.slice(0, 3)).map((l, i) => (
                  <div key={i} className="mb-2.5 text-xs">
                    <div style={{ color: 'var(--hp-text-desc)' }}>{fmtDate(l.created_at)}</div>
                    <div style={{ color: 'var(--hp-text-primary)' }}><b>{l.actor_name}</b> — {l.action}</div>
                  </div>
                ))}
                {d.logs.length > 3 && (
                  <button type="button" onClick={() => setShowAllLogs((v) => !v)} className="text-xs font-semibold" style={{ color: 'var(--hp-primary)' }}>
                    {showAllLogs ? 'Thu gọn' : `Xem thêm (${d.logs.length - 3})`}
                  </button>
                )}
              </Section>
            </div>
          </div>
        )}
      </div>
      <style jsx global>{`
        .hp-input { padding: 8px 12px; border: 1px solid var(--hp-border); border-radius: 8px; font-size: 13px; outline: none; background: var(--hp-card); color: var(--hp-text-primary); }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--hp-success)' }}>{title}</div>
      {children}
    </div>
  )
}

function InfoRow({ icon, label, value, multiline }: { icon: React.ReactNode; label: string; value?: React.ReactNode; multiline?: boolean }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className={`mt-1.5 flex gap-2 ${multiline ? 'items-start' : 'items-center'}`}>
      <span style={{ color: 'var(--hp-text-desc)' }}>{icon}</span>
      <div>
        <div className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>{label}</div>
        <div className={`text-sm ${multiline ? 'whitespace-pre-wrap' : ''}`} style={{ color: 'var(--hp-text-primary)' }}>{value}</div>
      </div>
    </div>
  )
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const colors = ['#096AA7', '#60BB46', '#FFA726', '#E53935', '#8b5cf6', '#06b6d4']
  const idx = name ? name.charCodeAt(0) % colors.length : 0
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: colors[idx] }}>
      {name?.[0] ?? '?'}
    </div>
  )
}
