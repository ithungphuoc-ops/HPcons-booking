'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Check, X } from 'lucide-react'
import { GROUP_ICONS, groupIcon } from './groupIcons'
import type { MemberOption } from './BookingFormDialog'

type ResourceRow = { id: string; name: string; color: string; capacity: number | null; plate: string | null; approver_ids: string[]; is_active: boolean; manager_id: string | null; follower_ids: string[] }
type GroupRow = { id: string; name: string; icon: string; is_active: boolean; resources: ResourceRow[] }
type ResourceItem = { id: string; name: string; color: string; capacity: number | null; plate: string | null; approver_ids: string[] }
type GroupItem = { id: string; name: string; icon: string; resources: ResourceItem[] }

// PATCH { type, ...patch } lên /api/booking-resources/{id} — dùng chung cho
// sửa và tắt/bật (xóa mềm), nhất quán convention của booking-purposes.
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

export default function ManageResourcesPanel({ groups, members, onChanged }: { groups: GroupItem[]; members: MemberOption[]; onChanged: () => void }) {
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

  // ── Sửa/tắt-bật nhóm ──
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
        }),
      })
      setResName(''); setResCapacity(''); setResPlate(''); setResApprovers([]); setResManagerId(''); setResFollowers([])
      await refresh()
    } finally { setSavingRes(false) }
  }

  // ── Sửa/tắt-bật tài nguyên ──
  const [editingResId, setEditingResId] = useState<string | null>(null)
  const [editResName, setEditResName] = useState('')
  const [editResColor, setEditResColor] = useState('#096AA7')
  const [editResCapacity, setEditResCapacity] = useState('')
  const [editResPlate, setEditResPlate] = useState('')
  const [editResApprovers, setEditResApprovers] = useState<string[]>([])
  const [editResManagerId, setEditResManagerId] = useState('')
  const [editResFollowers, setEditResFollowers] = useState<MemberOption[]>([])
  const [savingResEdit, setSavingResEdit] = useState(false)

  function openEditResource(r: ResourceRow) {
    setEditingResId(r.id)
    setEditResName(r.name); setEditResColor(r.color)
    setEditResCapacity(r.capacity != null ? String(r.capacity) : '')
    setEditResPlate(r.plate ?? ''); setEditResApprovers(r.approver_ids ?? [])
    setEditResManagerId(r.manager_id ?? '')
    setEditResFollowers(members.filter((m) => (r.follower_ids ?? []).includes(m.id)))
  }

  async function saveResourceEdit(id: string) {
    setSavingResEdit(true)
    try {
      await patchResource(id, {
        type: 'resource',
        name: editResName.trim(),
        color: editResColor,
        capacity: editResCapacity || null,
        plate: editResPlate || null,
        approver_ids: editResApprovers,
        manager_id: editResManagerId || null,
        follower_ids: editResFollowers.map((f) => f.id),
      })
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
  const activeResources = allGroups.flatMap((g) => g.resources.filter((r) => r.is_active).map((r) => ({ ...r, groupName: g.name })))
  const inactiveResources = allGroups.flatMap((g) => g.resources.filter((r) => !r.is_active).map((r) => ({ ...r, groupName: g.name })))

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
              title={g.is_active ? 'Tắt nhóm (ẩn, giữ lịch sử)' : 'Bật lại nhóm'}
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

  function renderResourceRow(r: ResourceRow & { groupName: string }) {
    const editing = editingResId === r.id
    return (
      <div key={r.id} className="rounded-lg px-2.5 py-1.5" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
        {editing ? (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input value={editResName} onChange={(e) => setEditResName(e.target.value)} className="hp-input flex-1" />
              <input type="color" value={editResColor} onChange={(e) => setEditResColor(e.target.value)} className="h-8 w-9 rounded-lg border" style={{ borderColor: 'var(--hp-border)' }} />
            </div>
            <div className="flex gap-2">
              <input value={editResCapacity} onChange={(e) => setEditResCapacity(e.target.value)} placeholder="Sức chứa" type="number" className="hp-input flex-1" />
              <input value={editResPlate} onChange={(e) => setEditResPlate(e.target.value)} placeholder="Biển số" className="hp-input flex-1" />
            </div>
            <select multiple value={editResApprovers} onChange={(e) => setEditResApprovers(Array.from(e.target.selectedOptions, (o) => o.value))} className="hp-input h-16 w-full">
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <select value={editResManagerId} onChange={(e) => setEditResManagerId(e.target.value)} className="hp-input w-full">
              <option value="">— Người quản lý tài nguyên (tuỳ chọn) —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <FollowerPicker members={members} selected={editResFollowers} onChange={setEditResFollowers} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingResId(null)} className="rounded-lg p-1.5" style={{ color: 'var(--hp-text-desc)' }}><X size={13} /></button>
              <button onClick={() => saveResourceEdit(r.id)} disabled={savingResEdit || !editResName.trim()} className="rounded-lg p-1.5 text-white" style={{ background: 'var(--hp-primary)' }}><Check size={13} /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: r.color }} />
            <span className="flex-1 truncate" style={{ textDecoration: r.is_active ? 'none' : 'line-through' }}>{r.name} <span style={{ color: 'var(--hp-text-desc)' }}>· {r.groupName}</span></span>
            <button onClick={() => openEditResource(r)} className="shrink-0 p-1 rounded" style={{ color: 'var(--hp-text-desc)' }} title="Sửa"><Pencil size={12} /></button>
            <button
              onClick={() => toggleResourceActive(r)}
              title={r.is_active ? 'Tắt tài nguyên (ẩn, giữ lịch sử)' : 'Bật lại tài nguyên'}
              className="relative h-[18px] w-8 shrink-0 rounded-full transition"
              style={{ background: r.is_active ? 'var(--hp-primary)' : 'var(--hp-neutral)' }}
            >
              <div className="absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white transition-all" style={{ left: r.is_active ? 16 : 2 }} />
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
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
              <div className="mb-1.5 text-[11px] font-semibold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Đã tắt ({inactiveGroups.length})</div>
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
            <select multiple value={resApprovers} onChange={(e) => setResApprovers(Array.from(e.target.selectedOptions, (o) => o.value))} className="hp-input h-20 w-full">
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <div className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>Giữ Ctrl để chọn nhiều người duyệt theo thứ tự cấp. Bỏ trống = tự động duyệt.</div>
            <select value={resManagerId} onChange={(e) => setResManagerId(e.target.value)} className="hp-input w-full">
              <option value="">— Người quản lý tài nguyên (tuỳ chọn) —</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            <FollowerPicker members={members} selected={resFollowers} onChange={setResFollowers} />
            <button type="submit" disabled={savingRes} className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
              {savingRes ? 'Đang lưu...' : 'Thêm tài nguyên'}
            </button>
          </form>

          <div className="mt-3 space-y-1.5 max-h-72 overflow-y-auto">
            {activeResources.map(renderResourceRow)}
            {inactiveResources.length > 0 && (
              <div className="pt-1.5">
                <div className="mb-1.5 text-[11px] font-semibold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Đã tắt ({inactiveResources.length})</div>
                <div className="space-y-1.5 opacity-60">{inactiveResources.map(renderResourceRow)}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Chọn nhiều người theo dõi riêng của 1 tài nguyên — tái dùng đúng pattern
// mention-chip của "Người theo dõi" trong BookingFormDialog.tsx.
function FollowerPicker({ members, selected, onChange }: { members: MemberOption[]; selected: MemberOption[]; onChange: (next: MemberOption[]) => void }) {
  const [query, setQuery] = useState('')
  const filtered = query.length > 0
    ? members.filter((m) => m.full_name.toLowerCase().includes(query.toLowerCase()) && !selected.find((s) => s.id === m.id))
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
