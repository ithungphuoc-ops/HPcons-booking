'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Paperclip, CalendarClock } from 'lucide-react'
import BookingDynamicFields, { type DynamicValue } from './BookingDynamicFields'
import type { BookingFormField } from '@/lib/firestore/types'

export type BookingPurposeOption = { id: string; name: string; form_schema: BookingFormField[] }
const OTHER_PURPOSE = '__other__'

export type BookingResourceOption = {
  id: string
  group_id: string
  name: string
  color: string
  capacity: number | null
  plate: string | null
  approver_ids: string[]
  description?: string | null
  manager_id?: string | null
}
export type BookingGroupOption = { id: string; name: string; icon: string }
export type MemberOption = { id: string; full_name: string; department?: string | null }

// Đăng ký đang sửa (20/07/2026) — CHỈ hỗ trợ sửa tiêu đề/thời gian/tài
// nguyên/mục đích/formData/mô tả, KHÔNG sửa người theo dõi/tệp đính kèm/quản
// lý trực tiếp (xem design.md của change booking-calendar-limits-import) —
// các field đó bị ẩn khi ở chế độ sửa để không gây hiểu nhầm là sẽ được lưu.
export type EditableBooking = {
  id: string
  resource_id: string
  title: string
  purpose_id: string | null
  purpose_text: string | null
  form_data?: { fieldId: string; label: string; type: string; value: unknown }[]
  note: string | null
  destination: string | null
  passengers: string | null
  quantity: number | null
  start_at: string
  end_at: string
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export default function BookingFormDialog({
  groups,
  resources,
  members,
  purposes,
  initialResourceId,
  initialSlot,
  editingBooking,
  onClose,
  onSaved,
}: {
  groups: BookingGroupOption[]
  resources: BookingResourceOption[]
  members: MemberOption[]
  purposes: BookingPurposeOption[]
  initialResourceId?: string
  initialSlot?: { start: string; end: string } | null
  editingBooking?: EditableBooking | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEditing = !!editingBooking
  const [resourceId, setResourceId] = useState(editingBooking?.resource_id ?? initialResourceId ?? '')
  const [title, setTitle] = useState(editingBooking?.title ?? '')
  // "Khác" (nhập tự do) luôn là lựa chọn cuối; mặc định chọn sẵn nếu công ty
  // chưa cấu hình mục đích nào — không được để màn hình trống không biết bấm
  // gì (xem design.md Decision 1 của change booking-purpose-form-designer).
  const [purposeId, setPurposeId] = useState(
    editingBooking?.purpose_id ?? (purposes.length === 0 ? OTHER_PURPOSE : ''),
  )
  const [purposeText, setPurposeText] = useState(editingBooking?.purpose_text ?? '')
  const [formValues, setFormValues] = useState<Record<string, DynamicValue>>(() => {
    const out: Record<string, DynamicValue> = {}
    for (const f of editingBooking?.form_data ?? []) out[f.fieldId] = f.value as DynamicValue
    return out
  })
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(editingBooking?.start_at?.slice(0, 10) ?? initialSlot?.start?.slice(0, 10) ?? todayStr())
  const [startTime, setStartTime] = useState(editingBooking?.start_at?.slice(11, 16) ?? initialSlot?.start?.slice(11, 16) ?? '08:00')
  const [endDate, setEndDate] = useState(editingBooking?.end_at?.slice(0, 10) ?? initialSlot?.end?.slice(0, 10) ?? todayStr())
  const [endTime, setEndTime] = useState(editingBooking?.end_at?.slice(11, 16) ?? initialSlot?.end?.slice(11, 16) ?? '09:00')
  const [note, setNote] = useState(editingBooking?.note ?? '')
  const [quantity, setQuantity] = useState(editingBooking?.quantity != null ? String(editingBooking.quantity) : '')
  const [destination, setDestination] = useState(editingBooking?.destination ?? '')
  const [passengers, setPassengers] = useState(editingBooking?.passengers ?? '')
  const [followerInput, setFollowerInput] = useState('')
  const [followers, setFollowers] = useState<MemberOption[]>([])
  const [managerId, setManagerId] = useState('')
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showBusy, setShowBusy] = useState(false)
  const [loadingBusy, setLoadingBusy] = useState(false)
  const [busyList, setBusyList] = useState<{ start_at: string; end_at: string; status: string; title: string }[]>([])

  // Xem nhanh khung giờ ĐÃ có lịch của tài nguyên trong đúng ngày bắt đầu đã
  // chọn — chỉ liệt kê đơn giản, không vẽ timeline đồ hoạ (đủ dùng để tránh
  // trùng giờ bằng mắt trước khi Lưu).
  useEffect(() => {
    if (!showBusy || !resourceId || !startDate) return
    setLoadingBusy(true)
    const from = new Date(`${startDate}T00:00:00`)
    const to = new Date(from); to.setDate(to.getDate() + 1)
    fetch(`/api/bookings?resource_id=${resourceId}&from=${from.toISOString()}&to=${to.toISOString()}`)
      .then((r) => r.json())
      .then((json) => {
        const rows = (json.bookings ?? []).filter((b: { status: string }) => b.status === 'pending' || b.status === 'approved')
        setBusyList(rows)
      })
      .finally(() => setLoadingBusy(false))
  }, [showBusy, resourceId, startDate])

  // Gợi ý sẵn quản lý trực tiếp thật (theo phòng ban) — GET /api/profile đã
  // trả sẵn `manager`, không cần viết endpoint riêng. Người đặt vẫn đổi
  // được sang người khác nếu cần (xem select "Quản lý trực tiếp" bên dưới).
  useEffect(() => {
    if (isEditing) return
    fetch('/api/profile').then((r) => r.json()).then((p) => {
      if (p?.manager?.id) setManagerId(p.manager.id)
    }).catch(() => {})
  }, [isEditing])

  const resource = resources.find((r) => r.id === resourceId)
  const group = groups.find((g) => g.id === resource?.group_id)
  const isVehicle = group?.icon === 'Car'
  const selectedPurpose = purposes.find((p) => p.id === purposeId)
  const dynamicSchema = selectedPurpose?.form_schema ?? []

  async function handleDynamicFileUpload(fieldId: string, file: File) {
    setUploadingFieldId(fieldId)
    setError('')
    try {
      const fd = new FormData()
      fd.append('files', file)
      const res = await fetch('/api/bookings/attachments', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Lỗi tải tệp'); return }
      setFormValues((prev) => ({ ...prev, [fieldId]: json.attachments[0] }))
    } finally {
      setUploadingFieldId(null)
    }
  }

  // Bỏ tiền tố "@" nếu người dùng gõ theo thói quen kiểu mention (Base/Slack...)
  // — tên nhân viên không chứa ký tự "@" nên trước đây gõ "@thu" sẽ không khớp gì.
  const followerQuery = followerInput.replace(/^@/, '').trim().toLowerCase()
  const filteredMembers = followerQuery.length > 0
    ? members.filter((m) => m.full_name.toLowerCase().includes(followerQuery) && !followers.find((f) => f.id === m.id))
    : []

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploadingFiles(true)
    setError('')
    try {
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      const res = await fetch('/api/bookings/attachments', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Lỗi tải tệp'); return }
      setAttachments((prev) => [...prev, ...json.attachments])
    } finally {
      setUploadingFiles(false)
    }
  }

  const resourcesByGroup = useMemo(
    () => groups.map((g) => ({ ...g, items: resources.filter((r) => r.group_id === g.id) })),
    [groups, resources],
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!resourceId) return setError('Vui lòng chọn tài nguyên')
    if (!title.trim()) return setError('Vui lòng nhập tiêu đề')
    if (purposes.length > 0 && !purposeId) return setError('Vui lòng chọn mục đích')
    const startAt = new Date(`${startDate}T${startTime}:00`)
    const endAt = new Date(`${endDate}T${endTime}:00`)
    if (endAt <= startAt) return setError('Thời gian kết thúc phải sau thời gian bắt đầu')

    for (const field of dynamicSchema) {
      const v = formValues[field.id]
      const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
      if (field.required && empty) return setError(`Vui lòng điền "${field.label}"`)
    }

    const formData = dynamicSchema
      .filter((f) => formValues[f.id] !== undefined && formValues[f.id] !== null && formValues[f.id] !== '')
      .map((f) => ({ fieldId: f.id, label: f.label, type: f.type, value: formValues[f.id] }))

    const chosenPurposeId = purposeId && purposeId !== OTHER_PURPOSE ? purposeId : null
    const chosenPurposeText = !chosenPurposeId ? (purposeText.trim() || null) : null

    setSaving(true)
    try {
      const res = isEditing
        ? await fetch(`/api/bookings/${editingBooking!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'edit',
              resource_id: resourceId,
              title: title.trim(),
              purpose_id: chosenPurposeId,
              purpose_text: chosenPurposeText,
              form_data: formData,
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
              note: note || null,
              quantity: quantity ? Number(quantity) : null,
              destination: isVehicle ? (destination || null) : null,
              passengers: isVehicle ? (passengers || null) : null,
            }),
          })
        : await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              resource_id: resourceId,
              title: title.trim(),
              purpose_id: chosenPurposeId ?? undefined,
              purpose_text: chosenPurposeText ?? undefined,
              form_data: formData,
              manager_override_id: managerId || undefined,
              start_at: startAt.toISOString(),
              end_at: endAt.toISOString(),
              note: note || undefined,
              quantity: quantity ? Number(quantity) : undefined,
              destination: isVehicle ? destination || undefined : undefined,
              passengers: isVehicle ? passengers || undefined : undefined,
              attachments,
            }),
          })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? (isEditing ? 'Lỗi sửa đăng ký' : 'Lỗi tạo đặt lịch')); return }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-[600px] max-w-[95vw] flex-col overflow-hidden rounded-xl"
        style={{ background: 'var(--hp-card)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)' }}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-3.5" style={{ background: 'var(--hp-primary)' }}>
          <span className="text-sm font-bold uppercase tracking-wide text-white">
            {isEditing ? 'Sửa đăng ký' : 'Tạo đăng ký mới'}{resource ? ` — ${resource.name}` : ''}
          </span>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3.5 p-5">
            {!initialResourceId && (
              <Field label="Tài nguyên" required>
                <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} required className="hp-input">
                  <option value="">-- Chọn tài nguyên --</option>
                  {resourcesByGroup.map((g) => (
                    <optgroup key={g.id} label={g.name}>
                      {g.items.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </optgroup>
                  ))}
                </select>
              </Field>
            )}

            {resource?.description && (
              <div className="rounded-lg px-3.5 py-2.5 text-xs" style={{ background: 'var(--hp-primary-bg)', color: 'var(--hp-primary-soft)' }}>
                {resource.description}
              </div>
            )}

            <Field label="Tiêu đề đăng ký" required>
              <input className="hp-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nhập tiêu đề của đăng ký" required />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Bắt đầu lúc" required>
                <div className="flex gap-1.5">
                  <input type="date" className="hp-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                  <input type="time" className="hp-input w-[90px]" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
              </Field>
              <Field label="Kết thúc lúc" required>
                <div className="flex gap-1.5">
                  <input type="date" className="hp-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                  <input type="time" className="hp-input w-[90px]" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </Field>
            </div>

            {resourceId && (
              <div>
                <button
                  type="button"
                  onClick={() => setShowBusy((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: 'var(--hp-primary)' }}
                >
                  <CalendarClock size={13} /> {showBusy ? 'Ẩn thời gian bận' : 'Hiển thị thời gian bận'}
                </button>
                {showBusy && (
                  <div className="mt-1.5 rounded-lg p-2.5 text-xs" style={{ background: 'var(--hp-neutral-bg)' }}>
                    {loadingBusy ? (
                      <span style={{ color: 'var(--hp-text-desc)' }}>Đang tải...</span>
                    ) : busyList.length === 0 ? (
                      <span style={{ color: 'var(--hp-text-desc)' }}>Ngày này chưa có lịch nào cho tài nguyên đã chọn</span>
                    ) : (
                      <div className="space-y-1">
                        {busyList.map((b, i) => (
                          <div key={i}>
                            <b>{new Date(b.start_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}–{new Date(b.end_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</b>
                            {' '}· {b.title} ({b.status === 'approved' ? 'Đã duyệt' : 'Chờ duyệt'})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isEditing && (
              <Field label="Quản lý trực tiếp">
                <select className="hp-input" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
                  <option value="">— Không có quản lý trực tiếp —</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                </select>
              </Field>
            )}

            <Field label="Mục đích" required={purposes.length > 0}>
              <select
                className="hp-input"
                value={purposeId}
                onChange={(e) => { setPurposeId(e.target.value); setFormValues({}) }}
                required={purposes.length > 0}
              >
                {purposes.length > 0 && <option value="">-- Chọn mục đích --</option>}
                {purposes.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value={OTHER_PURPOSE}>Khác (nhập tự do)</option>
              </select>
              {purposeId === OTHER_PURPOSE && (
                <input className="hp-input mt-1.5" value={purposeText} onChange={(e) => setPurposeText(e.target.value)} placeholder="Nhập ngắn gọn mục đích đăng ký" />
              )}
            </Field>

            {dynamicSchema.length > 0 && (
              <BookingDynamicFields
                schema={dynamicSchema}
                values={formValues}
                onChange={(fieldId, value) => setFormValues((prev) => ({ ...prev, [fieldId]: value }))}
                onUploadFile={handleDynamicFileUpload}
                uploadingFieldId={uploadingFieldId}
              />
            )}

            {isVehicle && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Điểm đến"><input className="hp-input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Địa chỉ điểm đến" /></Field>
                <Field label="Hành khách"><input className="hp-input" value={passengers} onChange={(e) => setPassengers(e.target.value)} placeholder="Tên hành khách" /></Field>
              </div>
            )}

            {resource?.capacity != null && (
              <Field label="Số lượng"><input type="number" min={1} max={resource.capacity} className="hp-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={`Tối đa ${resource.capacity}`} /></Field>
            )}

            {!isEditing && (
              <Field label="Người theo dõi">
                <div className="relative">
                  <div className="hp-input flex min-h-10 flex-wrap items-center gap-1.5">
                    {followers.map((f) => (
                      <span key={f.id} className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs" style={{ background: 'var(--hp-primary-bg)', color: 'var(--hp-primary-soft)' }}>
                        {f.full_name}
                        <button type="button" onClick={() => setFollowers((fs) => fs.filter((x) => x.id !== f.id))} className="leading-none">×</button>
                      </span>
                    ))}
                    <input
                      value={followerInput}
                      onChange={(e) => setFollowerInput(e.target.value)}
                      placeholder={followers.length === 0 ? 'Gõ tên để tìm...' : ''}
                      className="min-w-[100px] flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  {filteredMembers.length > 0 && (
                    <div className="absolute left-0 right-0 top-full z-10 max-h-40 overflow-y-auto rounded-lg" style={{ background: 'var(--hp-elevated)', border: '1px solid var(--hp-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                      {filteredMembers.map((m) => (
                        <div key={m.id} onClick={() => { setFollowers((fs) => [...fs, m]); setFollowerInput('') }}
                          className="cursor-pointer px-3.5 py-2 text-sm hover:opacity-80">
                          <span className="font-semibold">{m.full_name}</span>
                          {m.department && <span className="ml-2 text-xs" style={{ color: 'var(--hp-text-desc)' }}>{m.department}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            )}

            <Field label="Mô tả">
              <textarea className="hp-input min-h-[72px] resize-y" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mô tả của đăng ký" />
            </Field>

            {!isEditing && (
              <Field label="Tệp đính kèm">
                <div className="flex flex-col gap-1.5">
                  {attachments.map((a, i) => (
                    <div key={a.url} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: 'var(--hp-neutral-bg)' }}>
                      <Paperclip size={12} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, x) => x !== i))} className="shrink-0" style={{ color: 'var(--hp-danger)' }}>×</button>
                    </div>
                  ))}
                  <input
                    type="file"
                    multiple
                    onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = '' }}
                    disabled={uploadingFiles || attachments.length >= 5}
                    className="text-xs"
                  />
                  <div className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>
                    {uploadingFiles ? 'Đang tải tệp...' : 'Ảnh, PDF, Word, Excel — tối đa 10MB/tệp, 5 tệp'}
                  </div>
                </div>
              </Field>
            )}

            {error && <div className="rounded-lg px-3.5 py-2 text-sm" style={{ background: 'var(--hp-danger-bg)', color: 'var(--hp-danger-soft)' }}>{error}</div>}
          </div>

          <div className="flex shrink-0 justify-end gap-2.5 px-5 py-3" style={{ borderTop: '1px solid var(--hp-divider)' }}>
            <button type="button" onClick={onClose} className="rounded-lg px-5 py-2 text-sm font-medium" style={{ background: 'var(--hp-neutral-bg)', color: 'var(--hp-text-secondary)' }}>Bỏ qua</button>
            <button type="submit" disabled={saving} className="rounded-lg px-6 py-2 text-sm font-bold text-white disabled:opacity-60" style={{ background: 'var(--hp-success)' }}>
              {saving ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .hp-input {
          padding: 8px 12px;
          border: 1px solid var(--hp-border);
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          background: var(--hp-card);
          color: var(--hp-text-primary);
          width: 100%;
        }
        .hp-input:focus { border-color: var(--hp-primary); }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" style={{ color: 'var(--hp-text-secondary)' }}>
        {label} {required && <span style={{ color: 'var(--hp-danger)' }}>*</span>}
      </label>
      {children}
    </div>
  )
}
