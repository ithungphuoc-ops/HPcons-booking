import type { LucideIcon } from 'lucide-react'

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'

// KPI Card chuẩn Phần E1 V1.1 — bắt buộc đủ 4 thành phần: Icon, Tiêu đề, Giá trị chính, Thông tin phụ.
export default function KpiCard({
  icon: Icon,
  title,
  value,
  sub,
  tone = 'primary',
}: {
  icon: LucideIcon
  title: string
  value: string | number
  sub: string
  tone?: Tone
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl p-4"
      style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
        style={{ background: `var(--hp-${tone}-bg)`, color: `var(--hp-${tone}-soft)` }}
      >
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>{title}</div>
        <div className="text-2xl font-bold" style={{ color: 'var(--hp-text-primary)' }}>{value}</div>
        <div className="truncate text-xs" style={{ color: 'var(--hp-text-desc)' }}>{sub}</div>
      </div>
    </div>
  )
}
