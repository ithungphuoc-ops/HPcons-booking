'use client'

import { Paperclip } from 'lucide-react'
import type { BookingFormFieldType } from '@/lib/firestore/types'
import DatePicker from '@/components/ui/DatePicker'

export type DynamicField = { id: string; label: string; type: BookingFormFieldType; required: boolean; options?: string[] }
export type DynamicValue = string | number | boolean | string[] | { name: string; url: string } | null

// Render động các trường tuỳ chỉnh theo formSchema của 1 mục đích — dùng
// chung cho form tạo đăng ký (BookingFormDialog) VÀ bản xem trước trong
// trình thiết kế biểu mẫu (/bookings/purposes). Ở chế độ xem trước, không
// truyền `onUploadFile` — trường "file" hiển thị nhưng không tải được.
export default function BookingDynamicFields({
  schema,
  values,
  onChange,
  onUploadFile,
  uploadingFieldId,
}: {
  schema: DynamicField[]
  values: Record<string, DynamicValue>
  onChange: (fieldId: string, value: DynamicValue) => void
  onUploadFile?: (fieldId: string, file: File) => void
  uploadingFieldId?: string | null
}) {
  if (schema.length === 0) return null

  return (
    <div className="flex flex-col gap-3.5 rounded-lg p-3" style={{ background: 'var(--hp-neutral-bg)' }}>
      {schema.map((field) => {
        const value = values[field.id]
        const label = (
          <label className="text-xs font-semibold" style={{ color: 'var(--hp-text-secondary)' }}>
            {field.label} {field.required && <span style={{ color: 'var(--hp-danger)' }}>*</span>}
          </label>
        )

        if (field.type === 'text') {
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {label}
              <input className="hp-input" value={(value as string) ?? ''} onChange={(e) => onChange(field.id, e.target.value)} />
            </div>
          )
        }
        if (field.type === 'textarea') {
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {label}
              <textarea className="hp-input min-h-[64px] resize-y" value={(value as string) ?? ''} onChange={(e) => onChange(field.id, e.target.value)} />
            </div>
          )
        }
        if (field.type === 'number') {
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {label}
              <input type="number" className="hp-input" value={(value as number) ?? ''} onChange={(e) => onChange(field.id, e.target.value === '' ? null : Number(e.target.value))} />
            </div>
          )
        }
        if (field.type === 'date') {
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {label}
              <DatePicker className="hp-input text-left" value={(value as string) ?? ''} onChange={(v) => onChange(field.id, v)} />
            </div>
          )
        }
        if (field.type === 'select') {
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {label}
              <select className="hp-input" value={(value as string) ?? ''} onChange={(e) => onChange(field.id, e.target.value)}>
                <option value="">-- Chọn --</option>
                {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )
        }
        if (field.type === 'multiselect') {
          const selected = Array.isArray(value) ? value : []
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              {label}
              <select
                multiple
                className="hp-input h-20"
                value={selected}
                onChange={(e) => onChange(field.id, Array.from(e.target.selectedOptions, (o) => o.value))}
              >
                {(field.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          )
        }
        if (field.type === 'checkbox') {
          return (
            <label key={field.id} className="flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--hp-text-secondary)' }}>
              <input type="checkbox" checked={!!value} onChange={(e) => onChange(field.id, e.target.checked)} />
              {field.label} {field.required && <span style={{ color: 'var(--hp-danger)' }}>*</span>}
            </label>
          )
        }
        // file
        const fileValue = value as { name: string; url: string } | null
        return (
          <div key={field.id} className="flex flex-col gap-1.5">
            {label}
            {fileValue ? (
              <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs" style={{ background: 'var(--hp-card)' }}>
                <Paperclip size={12} className="shrink-0" />
                <a href={fileValue.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate">{fileValue.name}</a>
                <button type="button" onClick={() => onChange(field.id, null)} className="shrink-0" style={{ color: 'var(--hp-danger)' }}>×</button>
              </div>
            ) : (
              <input
                type="file"
                className="text-xs"
                disabled={!onUploadFile || uploadingFieldId === field.id}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file && onUploadFile) onUploadFile(field.id, file)
                  e.target.value = ''
                }}
              />
            )}
            {!onUploadFile && <div className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>(Xem trước — không tải tệp thật ở đây)</div>}
          </div>
        )
      })}
    </div>
  )
}
