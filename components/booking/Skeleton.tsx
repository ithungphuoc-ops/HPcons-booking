// Skeleton loading chuẩn Phần E3 V1.1 — dùng khi đang tải, đúng hình dạng nội dung sẽ hiện.
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md ${className}`} style={{ background: 'var(--hp-divider)' }} />
}

export function BookingRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
      <Skeleton className="h-10 w-1 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20 rounded-full" />
    </div>
  )
}
