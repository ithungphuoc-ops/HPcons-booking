const STATUS_MAP: Record<string, { label: string; tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  pending: { label: 'Chờ duyệt', tone: 'warning' },
  approved: { label: 'Đã duyệt', tone: 'success' },
  rejected: { label: 'Từ chối', tone: 'danger' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' },
  waiting: { label: 'Chưa tới lượt', tone: 'neutral' },
}

// Component Badge trạng thái — 5 biến thể theo Phần E4 V1.1 (nền -bg, chữ -soft, luôn kèm chữ).
export default function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, tone: 'neutral' as const }
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ background: `var(--hp-${s.tone}-bg)`, color: `var(--hp-${s.tone}-soft)` }}
    >
      {s.label}
    </span>
  )
}
