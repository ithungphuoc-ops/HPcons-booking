'use client'

import { useState } from 'react'
import { GripVertical, Trash2, Save } from 'lucide-react'
import BookingDynamicFields, { type DynamicValue } from './BookingDynamicFields'
import type { BookingFormField, BookingFormFieldType } from '@/lib/firestore/types'

const FIELD_TYPES: { value: BookingFormFieldType; label: string }[] = [
  { value: 'text', label: 'Văn bản ngắn' },
  { value: 'textarea', label: 'Văn bản dài' },
  { value: 'number', label: 'Số' },
  { value: 'date', label: 'Ngày' },
  { value: 'select', label: 'Chọn 1' },
  { value: 'multiselect', label: 'Chọn nhiều' },
  { value: 'checkbox', label: 'Có/Không' },
  { value: 'file', label: 'Tệp đính kèm' },
]

function newField(): BookingFormField {
  return { id: crypto.randomUUID(), label: '', type: 'text', required: false, options: [] }
}

// Trình thiết kế biểu mẫu tuỳ chỉnh của 1 mục đích — thêm/sửa/xoá trường,
// kéo-thả sắp xếp lại thứ tự (HTML5 draggable gốc, không thêm thư viện —
// xem design.md Decision 3 của change booking-purpose-form-designer).
export default function PurposeFormDesigner({ purposeId, initialSchema, onSaved }: {
  purposeId: string
  initialSchema: BookingFormField[]
  onSaved: (schema: BookingFormField[]) => void
}) {
  const [fields, setFields] = useState<BookingFormField[]>(initialSchema.length > 0 ? initialSchema : [])
  const [previewValues, setPreviewValues] = useState<Record<string, DynamicValue>>({})
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateField(i: number, patch: Partial<BookingFormField>) {
    setFields((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  function removeField(i: number) {
    setFields((prev) => prev.filter((_, idx) => idx !== i))
  }

  function onDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return
    setFields((prev) => {
      const next = [...prev]
      const [moved] = next.splice(dragIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDragIndex(null)
  }

  async function save() {
    setError('')
    for (const f of fields) {
      if (!f.label.trim()) { setError('Mỗi trường cần có nhãn'); return }
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/booking-purposes/${purposeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_schema: fields }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Lỗi lưu biểu mẫu'); return }
      onSaved(fields)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 grid gap-3 rounded-lg p-3 md:grid-cols-2" style={{ background: 'var(--hp-surface)', border: '1px solid var(--hp-border)' }}>
      <div>
        <div className="mb-2 text-xs font-bold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Các trường tuỳ chỉnh</div>
        <div className="flex flex-col gap-1.5">
          {fields.map((f, i) => (
            <div
              key={f.id}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="flex flex-wrap items-center gap-1.5 rounded-lg p-2"
              style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}
            >
              <GripVertical size={14} className="shrink-0 cursor-grab" style={{ color: 'var(--hp-text-desc)' }} />
              <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Nhãn trường" className="hp-input min-w-[100px] flex-1" />
              <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as BookingFormFieldType })} className="hp-input w-auto">
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-1 text-[11px]">
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(i, { required: e.target.checked })} /> Bắt buộc
              </label>
              <button type="button" onClick={() => removeField(i)} style={{ color: 'var(--hp-danger)' }}><Trash2 size={14} /></button>
              {(f.type === 'select' || f.type === 'multiselect') && (
                <input
                  value={(f.options ?? []).join(', ')}
                  onChange={(e) => updateField(i, { options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean) })}
                  placeholder="Các lựa chọn, cách nhau bằng dấu phẩy"
                  className="hp-input w-full"
                />
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setFields((prev) => [...prev, newField()])} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--hp-neutral-bg)', color: 'var(--hp-text-secondary)' }}>
          + Thêm trường
        </button>
        {error && <div className="mt-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: 'var(--hp-danger-bg)', color: 'var(--hp-danger-soft)' }}>{error}</div>}
        <button type="button" onClick={save} disabled={saving} className="mt-2 flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
          <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu biểu mẫu'}
        </button>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase" style={{ color: 'var(--hp-text-desc)' }}>Xem trước</div>
        {fields.length === 0 ? (
          <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>Chưa có trường nào — thêm ở bên trái để xem trước.</div>
        ) : (
          <BookingDynamicFields
            schema={fields}
            values={previewValues}
            onChange={(fieldId, value) => setPreviewValues((prev) => ({ ...prev, [fieldId]: value }))}
          />
        )}
      </div>
    </div>
  )
}
