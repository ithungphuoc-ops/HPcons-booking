import type { LucideIcon } from 'lucide-react'

// Empty State chuẩn Phần E3 V1.1 — icon + tiêu đề + mô tả (+ hành động nếu có), cấm để khoảng trắng lớn.
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <div
        className="mb-1 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: 'var(--hp-neutral-bg)', color: 'var(--hp-text-desc)' }}
      >
        <Icon size={22} />
      </div>
      <div className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}>{title}</div>
      {description && <div className="max-w-xs text-xs" style={{ color: 'var(--hp-text-desc)' }}>{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
