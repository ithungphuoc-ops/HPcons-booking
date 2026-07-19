const TONE_MAP: Record<string, string> = {
  pending: 'var(--hp-warning)',
  approved: 'var(--hp-success)',
  rejected: 'var(--hp-danger)',
  waiting: 'var(--hp-neutral)',
}

// Chấm tròn màu nhỏ cạnh avatar người duyệt (khác StatusBadge dạng pill có
// chữ) — đúng kiểu Base.vn hiện ở danh sách "NGƯỜI DUYỆT".
export default function ApprovalStatusDot({ status }: { status: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ background: TONE_MAP[status] ?? 'var(--hp-neutral)' }}
      title={status}
    />
  )
}
