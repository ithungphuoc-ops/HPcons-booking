'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Search, X } from 'lucide-react'
import { groupIcon } from './groupIcons'
import type { BookingGroupOption, BookingResourceOption } from './BookingFormDialog'
import HighlightMatch from '@/components/ui/HighlightMatch'

type GroupWithResources = BookingGroupOption & { description: string | null; resources: BookingResourceOption[] }

// Modal chọn nhanh tài nguyên theo 2 bước khi bấm vào 1 ô ngày trên lịch:
// bước 1 chọn Nhóm, bước 2 chọn Tài nguyên cụ thể trong nhóm đó.
export default function QuickBookModal({
  groups,
  dateStr,
  onClose,
  onPicked,
}: {
  groups: GroupWithResources[]
  dateStr: string
  onClose: () => void
  onPicked: (resourceId: string) => void
}) {
  const [groupId, setGroupId] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  const activeGroup = groups.find((g) => g.id === groupId) ?? null

  const filteredGroups = useMemo(
    () => (query ? groups.filter((g) => g.name.toLowerCase().includes(query.toLowerCase())) : groups),
    [groups, query],
  )
  const filteredResources = useMemo(
    () => (activeGroup ? activeGroup.resources.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())) : []),
    [activeGroup, query],
  )

  const dateLabel = new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  function selectGroup(id: string) {
    setGroupId(id)
    setQuery('')
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[440px] max-w-[95vw] flex-col overflow-hidden rounded-xl"
        style={{ background: 'var(--hp-card)', boxShadow: '0 24px 80px rgba(0,0,0,0.18)' }}
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--hp-border)' }}>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--hp-text-secondary)' }}>
              {activeGroup ? 'Chọn tài nguyên' : 'Chọn hoặc tìm kiếm nhóm tài nguyên'}
            </div>
            <div className="truncate text-xs" style={{ color: 'var(--hp-text-desc)' }}>{dateLabel}</div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--hp-text-secondary)' }}><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: 'var(--hp-border)' }}>
          {activeGroup && (
            <button type="button" onClick={() => { setGroupId(null); setQuery('') }} style={{ color: 'var(--hp-text-secondary)' }}>
              <ArrowLeft size={16} />
            </button>
          )}
          <Search size={14} style={{ color: 'var(--hp-text-desc)' }} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={activeGroup ? 'Tìm tài nguyên...' : 'Tìm nhanh nhóm tài nguyên...'}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--hp-text-primary)' }}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {!activeGroup ? (
            filteredGroups.length === 0 ? (
              <div className="p-4 text-center text-sm" style={{ color: 'var(--hp-text-desc)' }}>Không tìm thấy nhóm nào</div>
            ) : (
              filteredGroups.map((g) => {
                const Icon = groupIcon(g.icon)
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => selectGroup(g.id)}
                    className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition hover:opacity-80"
                    style={{ borderColor: 'var(--hp-border)' }}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--hp-primary-bg)', color: 'var(--hp-primary)' }}>
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}><HighlightMatch text={g.name} query={query} /></div>
                      {g.description && <div className="truncate text-xs" style={{ color: 'var(--hp-text-desc)' }}>{g.description}</div>}
                    </div>
                  </button>
                )
              })
            )
          ) : filteredResources.length === 0 ? (
            <div className="p-4 text-center text-sm" style={{ color: 'var(--hp-text-desc)' }}>Nhóm này chưa có tài nguyên nào</div>
          ) : (
            filteredResources.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onPicked(r.id)}
                className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition hover:opacity-80"
                style={{ borderColor: 'var(--hp-border)' }}
              >
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}><HighlightMatch text={r.name} query={query} /></div>
                  {(r.description || r.capacity != null) && (
                    <div className="truncate text-xs" style={{ color: 'var(--hp-text-desc)' }}>
                      {r.description}{r.description && r.capacity != null ? ' · ' : ''}{r.capacity != null ? `Sức chứa ${r.capacity}` : ''}
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
