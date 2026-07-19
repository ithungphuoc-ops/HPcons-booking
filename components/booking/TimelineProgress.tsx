'use client'

import { useMemo } from 'react'

// Timeline Progress chuẩn Phần E2 V1.1 — cho mọi màn hình có thời hạn.
// Hiển thị: ngày bắt đầu/kết thúc, % thời gian đã dùng, số ngày/giờ còn lại (hoặc hoàn thành).
export default function TimelineProgress({ startAt, endAt }: { startAt: Date; endAt: Date }) {
  // eslint-disable-next-line react-hooks/purity -- chốt "hiện tại" tại thời điểm mở dialog, không cần tick từng giây
  const now = useMemo(() => Date.now(), [])
  const total = endAt.getTime() - startAt.getTime()
  const used = Math.min(Math.max(now - startAt.getTime(), 0), total)
  const pct = total > 0 ? Math.round((used / total) * 100) : 100
  const isDone = now >= endAt.getTime()
  const notStarted = now < startAt.getTime()
  const tone = isDone ? 'success' : pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'primary'

  const remainingLabel = isDone
    ? 'Đã hoàn thành'
    : notStarted
      ? `Bắt đầu sau ${formatDuration(startAt.getTime() - now)}`
      : `Còn ${formatDuration(endAt.getTime() - now)}`

  const fmt = (d: Date) => d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--hp-text-desc)' }}>{fmt(startAt)} → {fmt(endAt)}</span>
        <span className="font-semibold" style={{ color: `var(--hp-${tone}-soft)` }}>{remainingLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--hp-divider)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${notStarted ? 0 : pct}%`, background: `var(--hp-${tone})` }} />
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days} ngày ${hours} giờ`
  if (hours > 0) return `${hours} giờ ${minutes} phút`
  return `${minutes} phút`
}
