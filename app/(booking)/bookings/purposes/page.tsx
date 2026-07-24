'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Target, Pencil, Check, X, LayoutGrid } from 'lucide-react'
import EmptyState from '@/components/booking/EmptyState'
import PurposeFormDesigner from '@/components/booking/PurposeFormDesigner'
import type { BookingFormField } from '@/lib/firestore/types'

type Purpose = { id: string; name: string; is_active: boolean; creator_name: string | null; count: number; form_schema: BookingFormField[] }

export default function PurposesPage() {
  const [purposes, setPurposes] = useState<Purpose[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [designingId, setDesigningId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, profileRes] = await Promise.all([fetch('/api/booking-purposes'), fetch('/api/profile')])
      setPurposes(await pRes.json())
      const profile = await profileRes.json()
      setIsAdmin(profile.role === 'owner' || profile.role === 'admin')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addPurpose(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/booking-purposes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Lỗi'); return }
      setNewName(''); load()
    } finally { setSaving(false) }
  }

  async function toggle(id: string) {
    await fetch(`/api/booking-purposes/${id}`, { method: 'PATCH' })
    load()
  }

  function startEdit(p: Purpose) {
    setEditingId(p.id); setEditName(p.name)
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/booking-purposes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Lỗi'); return }
      setEditingId(null)
      await load()
    } finally {
      setSavingEdit(false)
    }
  }

  const filtered = search ? purposes.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : purposes
  const active = filtered.filter((p) => p.is_active)
  const inactive = filtered.filter((p) => !p.is_active)

  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-6" style={{ color: 'var(--hp-text-primary)' }}>
      <Link href="/bookings" className="mb-3 inline-flex items-center gap-1 text-sm" style={{ color: 'var(--hp-text-desc)' }}>
        <ArrowLeft size={14} /> Quay lại Booking
      </Link>
      <h1 className="mb-1 text-xl font-bold">Mục đích đặt lịch</h1>
      <p className="mb-5 text-sm" style={{ color: 'var(--hp-text-desc)' }}>Danh sách mục đích được dùng khi tạo đặt lịch</p>

      <div className="mb-4 flex items-center gap-2 rounded-lg px-3.5 py-2" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
        <Search size={15} style={{ color: 'var(--hp-text-desc)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm mục đích..." className="flex-1 bg-transparent text-sm outline-none" />
        <span className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>{purposes.length} mục đích</span>
      </div>

      {isAdmin && (
        <form onSubmit={addPurpose} className="mb-5 flex gap-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Tên mục đích mới..." className="hp-input flex-1" />
          <button type="submit" disabled={saving} className="rounded-lg px-5 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>+ Thêm</button>
        </form>
      )}

      {loading ? (
        <div className="text-sm" style={{ color: 'var(--hp-text-desc)' }}>Đang tải...</div>
      ) : active.length === 0 ? (
        <EmptyState icon={Target} title="Chưa có mục đích nào" description={search ? 'Không tìm thấy kết quả' : 'Admin có thể thêm mục đích mới ở trên'} />
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
          {active.map((p, i) => (
            <div key={p.id}>
              <PurposeRow
                p={p} last={i === active.length - 1 && designingId !== p.id} isAdmin={isAdmin}
                onToggle={() => toggle(p.id)}
                editing={editingId === p.id} editName={editName} onEditNameChange={setEditName}
                onStartEdit={() => startEdit(p)} onCancelEdit={() => setEditingId(null)}
                onSaveEdit={() => saveEdit(p.id)} savingEdit={savingEdit}
                designing={designingId === p.id}
                onToggleDesign={() => setDesigningId((cur) => (cur === p.id ? null : p.id))}
              />
              {designingId === p.id && (
                <div className="px-4 pb-4">
                  <PurposeFormDesigner
                    purposeId={p.id}
                    initialSchema={p.form_schema}
                    onSaved={(schema) => {
                      setPurposes((prev) => prev.map((x) => (x.id === p.id ? { ...x, form_schema: schema } : x)))
                      setDesigningId(null)
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && inactive.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Đã tắt ({inactive.length})</div>
          <div className="overflow-hidden rounded-xl opacity-70" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
            {inactive.map((p, i) => (
            <PurposeRow
              key={p.id} p={p} last={i === inactive.length - 1} isAdmin={isAdmin}
              onToggle={() => toggle(p.id)}
              editing={editingId === p.id} editName={editName} onEditNameChange={setEditName}
              onStartEdit={() => startEdit(p)} onCancelEdit={() => setEditingId(null)}
              onSaveEdit={() => saveEdit(p.id)} savingEdit={savingEdit}
            />
          ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        .hp-input { padding: 8px 12px; border: 1px solid var(--hp-border); border-radius: 8px; font-size: 14px; outline: none; background: var(--hp-card); color: var(--hp-text-primary); }
      `}</style>
    </div>
  )
}

function PurposeRow({
  p, last, isAdmin, onToggle, editing, editName, onEditNameChange, onStartEdit, onCancelEdit, onSaveEdit, savingEdit,
  designing, onToggleDesign,
}: {
  p: Purpose; last: boolean; isAdmin: boolean; onToggle: () => void
  editing: boolean; editName: string; onEditNameChange: (v: string) => void
  onStartEdit: () => void; onCancelEdit: () => void; onSaveEdit: () => void; savingEdit: boolean
  designing?: boolean; onToggleDesign?: () => void
}) {
  if (editing) {
    return (
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: last ? 'none' : '1px solid var(--hp-divider)' }}>
        <input
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          className="hp-input flex-1"
          autoFocus
        />
        <button onClick={onSaveEdit} disabled={savingEdit || !editName.trim()} className="rounded-lg p-1.5 text-white" style={{ background: 'var(--hp-primary)' }}><Check size={14} /></button>
        <button onClick={onCancelEdit} className="rounded-lg p-1.5" style={{ color: 'var(--hp-text-desc)' }}><X size={14} /></button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: last ? 'none' : '1px solid var(--hp-divider)' }}>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold" style={{ color: p.is_active ? 'var(--hp-text-primary)' : 'var(--hp-text-disabled)', textDecoration: p.is_active ? 'none' : 'line-through' }}>{p.name}</div>
        <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>
          {p.creator_name ? `Tạo bởi ${p.creator_name}` : 'Mặc định hệ thống'}{p.count > 0 ? ` · ${p.count} lần dùng` : ''}
        </div>
      </div>
      <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ background: p.is_active ? 'var(--hp-success-bg)' : 'var(--hp-neutral-bg)', color: p.is_active ? 'var(--hp-success-soft)' : 'var(--hp-text-desc)' }}>
        {p.is_active ? 'Đang dùng' : 'Đã tắt'}
      </span>
      {p.form_schema.length > 0 && (
        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: 'var(--hp-primary-bg)', color: 'var(--hp-primary-soft)' }}>
          {p.form_schema.length} trường
        </span>
      )}
      {isAdmin && onToggleDesign && (
        <button onClick={onToggleDesign} className="shrink-0 p-1.5 rounded-lg" style={{ color: designing ? 'var(--hp-primary)' : 'var(--hp-text-desc)' }} title="Thiết kế biểu mẫu">
          <LayoutGrid size={14} />
        </button>
      )}
      {isAdmin && (
        <button onClick={onStartEdit} className="shrink-0 p-1.5 rounded-lg" style={{ color: 'var(--hp-text-desc)' }} title="Sửa tên">
          <Pencil size={14} />
        </button>
      )}
      {isAdmin && (
        <button onClick={onToggle} className="relative h-[22px] w-10 shrink-0 rounded-full transition" style={{ background: p.is_active ? 'var(--hp-primary)' : 'var(--hp-neutral)' }}>
          <div className="absolute top-[3px] h-4 w-4 rounded-full bg-white transition-all" style={{ left: p.is_active ? 20 : 4 }} />
        </button>
      )}
    </div>
  )
}
