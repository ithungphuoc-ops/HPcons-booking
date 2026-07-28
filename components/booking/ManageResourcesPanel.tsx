'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Check, X, Paperclip } from 'lucide-react'
import { GROUP_ICONS, groupIcon } from './groupIcons'
import type { MemberOption } from './BookingFormDialog'

type Attachment = { name: string; url: string }
type RegistrationType = 'auto' | 'approval'
type BookingWindow = { startHour: number; endHour: number; blockedWeekdays?: number[] }
type ResourceRow = {
  id: string; name: string; color: string; capacity: number | null; plate: string | null
  approver_ids: string[]; is_active: boolean; manager_id: string | null; follower_ids: string[]
  registration_type: RegistrationType; attachments: Attachment[]; booking_window: BookingWindow | null
}
const WEEKDAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
type GroupRow = { id: string; name: string; icon: string; is_active: boolean; resources: ResourceRow[] }
type ResourceItem = { id: string; name: string; color: string; capacity: number | null; plate: string | null; approver_ids: string[] }
type GroupItem = { id: string; name: string; icon: string; resources: ResourceItem[] }

// PATCH { type, ...patch } lên /api/booking-resources/{id} — dùng chung cho
// sửa và mở/đóng (xóa mềm), nhất quán convention của booking-purposes.
async function patchResource(id: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/booking-resources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Lỗi')
  return data
}

async function uploadResourceAttachments(files: File[]): Promise<Attachment[]> {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  const res = await fetch('/api/booking-resources/attachments', { method: 'POST', body: form })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Không tải được tệp')
  return data.attachments as Attachment[]
}

export default function ManageResourcesPanel({ groups, members, onChanged, isAdmin, myUserId }: {
  groups: GroupItem[]; members: MemberOption[]; onChanged: () => void; isAdmin: boolean; myUserId: string
}) {
  const [allGroups, setAllGroups] = useState<GroupRow[]>([])

  const loadAll = useCallback(async () => {
    const res = await fetch('/api/booking-resources?includeInactive=1')
    setAllGroups(await res.json())
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function refresh() {
    await loadAll()
    onChanged()
  }

  const memberName = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.full_name]))
    return (id: string | null) => (id ? (map.get(id) ?? '—') : '—')
  }, [members])

  // ── Thêm nhóm ──
  const [groupName, setGroupName] = useState('')
  const [groupIconKey, setGroupIconKey] = useState('Package')
  const [savingGroup, setSavingGroup] = useState(false)

  async function addGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!groupName.trim()) return
    setSavingGroup(true)
    try {
      await fetch('/api/booking-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'group', name: groupName.trim(), icon: groupIconKey }),
      })
      setGroupName('')
      await refresh()
    } finally { setSavingGroup(false) }
  }

  // ── Sửa/mở-đóng nhóm ──
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupIcon, setEditGroupIcon] = useState('Package')
  const [savingGroupEdit, setSavingGroupEdit] = useState(false)

  function openEditGroup(g: GroupRow) {
    setEditingGroupId(g.id); setEditGroupName(g.name); setEditGroupIcon(g.icon)
  }

  async function saveGroupEdit(id: string) {
    setSavingGroupEdit(true)
    try {
      await patchResource(id, { type: 'group', name: editGroupName.trim(), icon: editGroupIcon })
      setEditingGroupId(null)
      await refresh()
    } catch (e) { alert((e as Error).message) } finally { setSavingGroupEdit(false) }
  }

  async function toggleGroupActive(g: GroupRow) {
    try {
      await patchResource(g.id, { type: 'group', isActive: !g.is_active })
      await refresh()
    } catch (e) { alert((e as Error).message) }
  }

  // ── Thêm tài nguyên ──
  const [resGroupId, setResGroupId] = useState('')
  const [resName, setResName] = useState('')
  const [resColor, setResColor] = useState('#096AA7')
  const [resCapacity, setResCapacity] = useState('')
  const [resPlate, setResPlate] = useState('')
  const [resApprovers, setResApprovers] = useState<string[]>([])
  const [resManagerId, setResManagerId] = useState('')
  const [resFollowers, setResFollowers] = useState<MemberOption[]>([])
  const [resRegistrationType, setResRegistrationType] = useState<RegistrationType>('approval')
  const [resAttachments, setResAttachments] = useState<Attachment[]>([])
  const [resBookingWindow, setResBookingWindow] = useState<BookingWindow | null>(null)
  const [savingRes, setSavingRes] = useState(false)

  async function addResource(e: React.FormEvent) {
    e.preventDefault()
    if (!resGroupId || !resName.trim()) return
    setSavingRes(true)
    try {
      await fetch('/api/booking-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          group_id: resGroupId,
          name: resName.trim(),
          color: resColor,
          capacity: resCapacity || undefined,
          plate: resPlate || undefined,
          approver_ids: resApprovers,
          manager_id: resManagerId || undefined,
          follower_ids: resFollowers.map((f) => f.id),
          registration_type: resRegistrationType,
          booking_window: resBookingWindow,
        }),
      })
      setResName(''); setResCapacity(''); setResPlate(''); setResApprovers([]); setResManagerId(''); setResFollowers([])
      setResRegistrationType('approval'); setResAttachments([]); setResBookingWindow(null)
      await refresh()
    } finally { setSavingRes(false) }
  }

  // ── Sửa/mở-đóng tài nguyên ──
  const [editingResId, setEditingResId] = useState<string | null>(null)
  const [editResName, setEditResName] = useState('')
  const [editResColor, setEditResColor] = useState('#096AA7')
  const [editResCapacity, setEditResCapacity] = useState('')
  const [editResPlate, setEditResPlate] = useState('')
  const [editResApprovers, setEditResApprovers] = useState<string[]>([])
  const [editResManagerId, setEditResManagerId] = useState('')
  const [editResFollowers, setEditResFollowers] = useState<MemberOption[]>([])
  const [editResRegistrationType, setEditResRegistrationType] = useState<RegistrationType>('approval')
  const [editResAttachments, setEditResAttachments] = useState<Attachment[]>([])
  const [editResBookingWindow, setEditResBookingWindow] = useState<BookingWindow | null>(null)
  const [savingResEdit, setSavingResEdit] = useState(false)

  function openEditResource(r: ResourceRow) {
    setEditingResId(r.id)
    setEditResName(r.name); setEditResColor(r.color)
    setEditResCapacity(r.capacity != null ? String(r.capacity) : '')
    setEditResPlate(r.plate ?? ''); setEditResApprovers(r.approver_ids ?? [])
    setEditResManagerId(r.manager_id ?? '')
    setEditResFollowers(members.filter((m) => (r.follower_ids ?? []).includes(m.id)))
    setEditResRegistrationType(r.registration_type ?? 'approval')
    setEditResAttachments(r.attachments ?? [])
    setEditResBookingWindow(r.booking_window ?? null)
  }

  async function saveResourceEdit(id: string) {
    setSavingResEdit(true)
    try {
      // "Quản lý tài nguyên" (không phải admin toàn cục) chỉ được gửi field
      // vận hành — gửi kèm field chính sách sẽ bị server từ chối cả request
      // (xem RESOURCE_MANAGER_ALLOWED_KEYS ở app/api/booking-resources/[id]/route.ts).
      const body = isAdmin
        ? {
            type: 'resource',
            name: editResName.trim(),
            color: editResColor,
            capacity: editResCapacity || null,
            plate: editResPlate || null,
            approver_ids: editResApprovers,
            manager_id: editResManagerId || null,
            follower_ids: editResFollowers.map((f) => f.id),
            registration_type: editResRegistrationType,
            attachments: editResAttachments,
            booking_window: editResBookingWindow,
          }
        : {
            type: 'resource',
            follower_ids: editResFollowers.map((f) => f.id),
            attachments: editResAttachments,
          }
      await patchResource(id, body)
      setEditingResId(null)
      await refresh()
    } catch (e) { alert((e as Error).message) } finally { setSavingResEdit(false) }
  }

  async function toggleResourceActive(r: ResourceRow) {
    try {
      await patchResource(r.id, { type: 'resource', isActive: !r.is_active })
      await refresh()
    } catch (e) { alert((e as Error).message) }
  }

  const activeGroups = allGroups.filter((g) => g.is_active)
  const inactiveGroups = allGroups.filter((g) => !g.is_active)

  // "Quản lý tài nguyên" (không phải admin toàn cục) chỉ thấy đúng tài nguyên
  // mình quản lý — admin thấy toàn bộ (xem design.md của change
  // booking-notifications-audit-permissions).
  const allResources = allGroups
    .flatMap((g) => g.resources.map((r) => ({ ...r, groupId: g.id, groupName: g.name })))
    .filter((r) => isAdmin || r.manager_id === myUserId)

  // ── Tìm kiếm/lọc bảng tài nguyên (client-side — số lượng tài nguyên nhỏ) ──
  const [search, setSearch] = useState('')
  const [filterGroupId, setFilterGroupId] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all')
  const [filterRegType, setFilterRegType] = useState<'all' | RegistrationType>('all')

  const filteredResources = allResources.filter((r) => {
    if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false
    if (filterGroupId && r.groupId !== filterGroupId) return false
    if (filterStatus === 'open' && !r.is_active) return false
    if (filterStatus === 'closed' && r.is_active) return false
    if (filterRegType !== 'all' && (r.registration_type ?? 'approval') !== filterRegType) return false
    return true
  })

  function renderGroupRow(g: GroupRow) {
    const Icon = groupIcon(g.icon)
    const editing = editingGroupId === g.id
    return (
      <div key={g.id} className="rounded-lg px-2.5 py-1.5" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} className="hp-input flex-1" />
            <select value={editGroupIcon} onChange={(e) => setEditGroupIcon(e.target.value)} className="hp-input w-auto">
              {Object.keys(GROUP_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <button onClick={() => saveGroupEdit(g.id)} disabled={savingGroupEdit || !editGroupName.trim()} className="rounded-lg p-1.5 text-white" style={{ background: 'var(--hp-primary)' }}><Check size={13} /></button>
            <button onClick={() => setEditingGroupId(null)} className="rounded-lg p-1.5" style={{ color: 'var(--hp-text-desc)' }}><X size={13} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <Icon size={13} className="shrink-0" />
            <span className="flex-1 truncate" style={{ textDecoration: g.is_active ? 'none' : 'line-through' }}>{g.name} · {g.resources.length}</span>
            <button onClick={() => openEditGroup(g)} className="shrink-0 p-1 rounded" style={{ color: 'var(--hp-text-desc)' }} title="Sửa"><Pencil size={12} /></button>
            <button
              onClick={() => toggleGroupActive(g)}
              title={g.is_active ? 'Đóng nhóm (ẩn, giữ lịch sử)' : 'Mở lại nhóm'}
              className="relative h-[18px] w-8 shrink-0 rounded-full transition"
              style={{ background: g.is_active ? 'var(--hp-primary)' : 'var(--hp-neutral)' }}
            >
              <div className="absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white transition-all" style={{ left: g.is_active ? 16 : 2 }} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
      {!isAdmin && (
        <div className="mb-4 rounded-lg px-3 py-2 text-xs" style={{ background: 'var(--hp-primary-bg)', color: 'var(--hp-primary-soft)' }}>
          Bạn đang xem với quyền "Quản lý tài nguyên" — chỉ thấy và sửa được đúng tài nguyên mình quản lý (mở/đóng, tệp đính kèm, người theo dõi).
        </div>
      )}
      {isAdmin && <ExcelImportPanel onImported={refresh} />}
      {isAdmin && (
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-bold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Thêm nhóm tài nguyên</div>
            <form onSubmit={addGroup} className="flex flex-wrap items-center gap-2">
              <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Tên nhóm, vd: Xe công tác" className="hp-input flex-1" />
              <select value={groupIconKey} onChange={(e) => setGroupIconKey(e.target.value)} className="hp-input w-auto">
                {Object.keys(GROUP_ICONS).map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <button type="submit" disabled={savingGroup} className="rounded-lg px-3 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}><Plus size={14} /></button>
            </form>

            <div className="mt-3 space-y-1.5">
              {activeGroups.map(renderGroupRow)}
            </div>
            {inactiveGroups.length > 0 && (
              <div className="mt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Đã đóng ({inactiveGroups.length})</div>
                <div className="space-y-1.5 opacity-60">{inactiveGroups.map(renderGroupRow)}</div>
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 text-xs font-bold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Thêm tài nguyên</div>
            <form onSubmit={addResource} className="space-y-2">
              <div className="flex gap-2">
                <select value={resGroupId} onChange={(e) => setResGroupId(e.target.value)} className="hp-input flex-1" required>
                  <option value="">-- Chọn nhóm --</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <input type="color" value={resColor} onChange={(e) => setResColor(e.target.value)} className="h-9 w-10 rounded-lg border" style={{ borderColor: 'var(--hp-border)' }} />
              </div>
              <input value={resName} onChange={(e) => setResName(e.target.value)} placeholder="Tên tài nguyên" className="hp-input w-full" required />
              <div className="flex gap-2">
                <input value={resCapacity} onChange={(e) => setResCapacity(e.target.value)} placeholder="Sức chứa/số lượng" type="number" className="hp-input flex-1" />
                <input value={resPlate} onChange={(e) => setResPlate(e.target.value)} placeholder="Biển số (nếu là xe)" className="hp-input flex-1" />
              </div>
              <RegistrationTypePicker value={resRegistrationType} onChange={setResRegistrationType} />
              {resRegistrationType === 'approval' && (
                <>
                  <select multiple value={resApprovers} onChange={(e) => setResApprovers(Array.from(e.target.selectedOptions, (o) => o.value))} className="hp-input h-20 w-full">
                    {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                  <div className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>(Không dùng nữa — chuỗi duyệt nay tự tính theo quản lý trực tiếp/nhân sự của người đặt.)</div>
                </>
              )}
              <select value={resManagerId} onChange={(e) => setResManagerId(e.target.value)} className="hp-input w-full">
                <option value="">— Người quản lý tài nguyên (tuỳ chọn) —</option>
                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              <FollowerPicker members={members} selected={resFollowers} onChange={setResFollowers} />
              <AttachmentPicker value={resAttachments} onChange={setResAttachments} />
              <BookingWindowPicker value={resBookingWindow} onChange={setResBookingWindow} />
              <button type="submit" disabled={savingRes} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
                {savingRes ? 'Đang lưu...' : 'Thêm tài nguyên'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="text-xs font-bold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Danh sách tài nguyên ({filteredResources.length})</div>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo tên..." className="hp-input ml-auto w-48" />
          <select value={filterGroupId} onChange={(e) => setFilterGroupId(e.target.value)} className="hp-input w-auto">
            <option value="">Tất cả nhóm</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="hp-input w-auto">
            <option value="all">Mọi trạng thái</option>
            <option value="open">Đang mở</option>
            <option value="closed">Đã đóng</option>
          </select>
          <select value={filterRegType} onChange={(e) => setFilterRegType(e.target.value as typeof filterRegType)} className="hp-input w-auto">
            <option value="all">Mọi loại đăng ký</option>
            <option value="approval">Cần duyệt</option>
            <option value="auto">Tự động duyệt</option>
          </select>
        </div>

        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--hp-border)' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--hp-card)' }}>
                <th className="w-6 px-2 py-2 text-left"></th>
                <th className="px-2 py-2 text-left font-semibold">Tên</th>
                <th className="px-2 py-2 text-left font-semibold">Nhóm</th>
                <th className="px-2 py-2 text-left font-semibold">Loại đăng ký</th>
                <th className="px-2 py-2 text-left font-semibold">Quản lý</th>
                <th className="px-2 py-2 text-left font-semibold">Theo dõi</th>
                <th className="px-2 py-2 text-left font-semibold">Trạng thái</th>
                <th className="px-2 py-2 text-left font-semibold">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredResources.map((r) => (
                <RowWithEdit
                  key={r.id}
                  r={r}
                  editing={editingResId === r.id}
                  memberName={memberName}
                  onEdit={() => openEditResource(r)}
                  onToggle={() => toggleResourceActive(r)}
                  editForm={
                    <tr>
                      <td colSpan={8} className="px-3 py-2" style={{ background: 'var(--hp-card)' }}>
                        <div className="space-y-1.5">
                          {isAdmin && (
                            <>
                              <div className="flex gap-2">
                                <input value={editResName} onChange={(e) => setEditResName(e.target.value)} className="hp-input flex-1" />
                                <input type="color" value={editResColor} onChange={(e) => setEditResColor(e.target.value)} className="h-8 w-9 rounded-lg border" style={{ borderColor: 'var(--hp-border)' }} />
                              </div>
                              <div className="flex gap-2">
                                <input value={editResCapacity} onChange={(e) => setEditResCapacity(e.target.value)} placeholder="Sức chứa" type="number" className="hp-input flex-1" />
                                <input value={editResPlate} onChange={(e) => setEditResPlate(e.target.value)} placeholder="Biển số" className="hp-input flex-1" />
                              </div>
                              <RegistrationTypePicker value={editResRegistrationType} onChange={setEditResRegistrationType} />
                              <select value={editResManagerId} onChange={(e) => setEditResManagerId(e.target.value)} className="hp-input w-full">
                                <option value="">— Người quản lý tài nguyên (tuỳ chọn) —</option>
                                {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                              </select>
                            </>
                          )}
                          <FollowerPicker members={members} selected={editResFollowers} onChange={setEditResFollowers} />
                          <AttachmentPicker value={editResAttachments} onChange={setEditResAttachments} />
                          {isAdmin && <BookingWindowPicker value={editResBookingWindow} onChange={setEditResBookingWindow} />}
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingResId(null)} className="rounded-lg p-1.5" style={{ color: 'var(--hp-text-desc)' }}><X size={13} /></button>
                            <button onClick={() => saveResourceEdit(r.id)} disabled={savingResEdit || !editResName.trim()} className="rounded-lg p-1.5 text-white" style={{ background: 'var(--hp-primary)' }}><Check size={13} /></button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  }
                />
              ))}
              {filteredResources.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-4 text-center" style={{ color: 'var(--hp-text-desc)' }}>Không có tài nguyên nào khớp bộ lọc.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function RowWithEdit({ r, editing, memberName, onEdit, onToggle, editForm }: {
  r: ResourceRow & { groupName: string }
  editing: boolean
  memberName: (id: string | null) => string
  onEdit: () => void
  onToggle: () => void
  editForm: React.ReactNode
}) {
  const isAuto = (r.registration_type ?? 'approval') === 'auto'
  return (
    <>
      <tr style={{ borderTop: '1px solid var(--hp-border)', opacity: r.is_active ? 1 : 0.55 }}>
        <td className="px-2 py-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: r.color }} /></td>
        <td className="px-2 py-1.5" style={{ textDecoration: r.is_active ? 'none' : 'line-through' }}>{r.name}</td>
        <td className="px-2 py-1.5" style={{ color: 'var(--hp-text-desc)' }}>{r.groupName}</td>
        <td className="px-2 py-1.5">
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={isAuto ? { background: '#FEF3C7', color: '#92400E' } : { background: 'var(--hp-card)', color: 'var(--hp-text-desc)' }}>
            {isAuto ? 'Tự động duyệt' : 'Cần duyệt'}
          </span>
        </td>
        <td className="px-2 py-1.5" style={{ color: 'var(--hp-text-desc)' }}>{memberName(r.manager_id)}</td>
        <td className="px-2 py-1.5" style={{ color: 'var(--hp-text-desc)' }}>{(r.follower_ids ?? []).length > 0 ? `${r.follower_ids.length} người` : '—'}</td>
        <td className="px-2 py-1.5">
          <button
            onClick={onToggle}
            title={r.is_active ? 'Đóng tài nguyên (ẩn, giữ lịch sử)' : 'Mở lại tài nguyên'}
            className="relative h-[18px] w-8 shrink-0 rounded-full transition"
            style={{ background: r.is_active ? 'var(--hp-primary)' : 'var(--hp-neutral)' }}
          >
            <div className="absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white transition-all" style={{ left: r.is_active ? 16 : 2 }} />
          </button>
          <span className="ml-1.5 align-middle text-[11px]">{r.is_active ? 'Mở' : 'Đóng'}</span>
        </td>
        <td className="px-2 py-1.5">
          <button onClick={onEdit} className="rounded p-1" style={{ color: 'var(--hp-text-desc)' }} title="Sửa"><Pencil size={12} /></button>
        </td>
      </tr>
      {editing && editForm}
    </>
  )
}

function RegistrationTypePicker({ value, onChange }: { value: RegistrationType; onChange: (v: RegistrationType) => void }) {
  return (
    <div className="flex gap-3 text-xs">
      <label className="flex items-center gap-1.5">
        <input type="radio" checked={value === 'approval'} onChange={() => onChange('approval')} /> Cần duyệt (mặc định)
      </label>
      <label className="flex items-center gap-1.5">
        <input type="radio" checked={value === 'auto'} onChange={() => onChange('auto')} /> Tự động duyệt
      </label>
    </div>
  )
}

// Tệp đính kèm của tài nguyên (khác hẳn attachments của booking) — tải qua
// app/api/booking-resources/attachments/route.ts.
function AttachmentPicker({ value, onChange }: { value: Attachment[]; onChange: (next: Attachment[]) => void }) {
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded = await uploadResourceAttachments(Array.from(files))
      onChange([...value, ...uploaded])
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-1.5">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((a, i) => (
            <span key={i} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
              <a href={a.url} target="_blank" rel="noreferrer" className="truncate max-w-[120px]">{a.name}</a>
              <button type="button" onClick={() => onChange(value.filter((_, idx) => idx !== i))} className="leading-none">×</button>
            </span>
          ))}
        </div>
      )}
      <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ border: '1px dashed var(--hp-border)', color: 'var(--hp-text-desc)' }}>
        <Paperclip size={12} /> {uploading ? 'Đang tải...' : 'Đính kèm tệp cho tài nguyên'}
        <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => handleFiles(e.target.files)} />
      </label>
    </div>
  )
}

// Nhập hàng loạt đăng ký từ Excel (20/07/2026, chỉ admin — cả panel này đã
// admin-only). Cột: Tên tài nguyên, Tiêu đề, Mục đích, Bắt đầu, Kết thúc
// (dd/mm/yyyy hh:mm). Server xử lý độc lập từng dòng, trả về số dòng thành
// công + danh sách lỗi kèm số dòng (xem app/api/bookings/import/route.ts).
function ExcelImportPanel({ onImported }: { onImported: () => void }) {
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<{ successCount: number; errors: { row: number; message: string }[] } | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setUploading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/bookings/import', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Lỗi nhập Excel'); return }
      setResult(json)
      if (json.successCount > 0) onImported()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="mb-4 rounded-lg p-2.5" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Nhập đăng ký từ Excel</span>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
          {uploading ? 'Đang xử lý...' : 'Chọn tệp .xlsx'}
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={uploading} onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <span className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>Cột: Tên tài nguyên, Tiêu đề, Mục đích, Bắt đầu (dd/mm/yyyy hh:mm), Kết thúc</span>
      </div>
      {result && (
        <div className="mt-2 text-xs">
          <div style={{ color: 'var(--hp-success-soft)' }}>Đã tạo thành công {result.successCount} đăng ký.</div>
          {result.errors.length > 0 && (
            <div className="mt-1 space-y-0.5" style={{ color: 'var(--hp-danger-soft)' }}>
              {result.errors.map((e, i) => <div key={i}>Dòng {e.row}: {e.message}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Giới hạn khung giờ được phép đặt (20/07/2026, tuỳ chọn theo tài nguyên) —
// tắt = không giới hạn (mặc định, theo xác nhận của Sếp).
function BookingWindowPicker({ value, onChange }: { value: BookingWindow | null; onChange: (v: BookingWindow | null) => void }) {
  const enabled = value !== null
  return (
    <div className="rounded-lg p-2.5" style={{ border: '1px solid var(--hp-border)' }}>
      <label className="flex items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onChange(e.target.checked ? { startHour: 7, endHour: 17, blockedWeekdays: [] } : null)}
        />
        Giới hạn khung giờ được phép đặt (mặc định: không giới hạn)
      </label>
      {enabled && value && (
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs">
            <span>Từ</span>
            <input type="number" min={0} max={24} value={value.startHour} onChange={(e) => onChange({ ...value, startHour: Number(e.target.value) })} className="hp-input w-16" />
            <span>giờ đến</span>
            <input type="number" min={0} max={24} value={value.endHour} onChange={(e) => onChange({ ...value, endHour: Number(e.target.value) })} className="hp-input w-16" />
            <span>giờ</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>Chặn ngày:</span>
            {WEEKDAY_LABELS.map((label, day) => {
              const blocked = (value.blockedWeekdays ?? []).includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    const cur = value.blockedWeekdays ?? []
                    onChange({ ...value, blockedWeekdays: blocked ? cur.filter((d) => d !== day) : [...cur, day] })
                  }}
                  className="rounded-full px-2 py-0.5"
                  style={blocked ? { background: 'var(--hp-danger)', color: '#fff' } : { background: 'var(--hp-neutral-bg)', color: 'var(--hp-text-secondary)' }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Chọn nhiều người theo dõi riêng của 1 tài nguyên — tái dùng đúng pattern
// mention-chip của "Người theo dõi" trong BookingFormDialog.tsx.
function FollowerPicker({ members, selected, onChange }: { members: MemberOption[]; selected: MemberOption[]; onChange: (next: MemberOption[]) => void }) {
  const [query, setQuery] = useState('')
  const q = query.replace(/^@/, '').trim().toLowerCase()
  const filtered = q.length > 0
    ? members.filter((m) =>
        (m.full_name.toLowerCase().includes(q) || (m.username && m.username.toLowerCase().includes(q))) &&
        !selected.find((s) => s.id === m.id))
    : []

  return (
    <div className="relative">
      <div className="hp-input flex min-h-9 flex-wrap items-center gap-1.5">
        {selected.map((f) => (
          <span key={f.id} className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: 'var(--hp-primary-bg)', color: 'var(--hp-primary-soft)' }}>
            {f.full_name}
            <button type="button" onClick={() => onChange(selected.filter((x) => x.id !== f.id))} className="leading-none">×</button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={selected.length === 0 ? 'Người theo dõi tài nguyên — gõ tên để tìm...' : ''}
          className="min-w-[100px] flex-1 bg-transparent text-xs outline-none"
        />
      </div>
      {filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-10 max-h-40 overflow-y-auto rounded-lg" style={{ background: 'var(--hp-elevated)', border: '1px solid var(--hp-border)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
          {filtered.map((m) => (
            <div key={m.id} onClick={() => { onChange([...selected, m]); setQuery('') }} className="cursor-pointer px-3 py-1.5 text-xs hover:opacity-80">
              {m.full_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
