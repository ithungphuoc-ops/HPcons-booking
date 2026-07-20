'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import type { CalendarBooking } from './MonthCalendar'

export function getDayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date); from.setHours(0, 0, 0, 0)
  const to = new Date(from); to.setDate(to.getDate() + 1)
  return { from, to }
}

// View Ngày — danh sách booking sắp theo giờ bắt đầu (không phải lưới giờ
// trực quan — xem design.md Decision 4 của change
// booking-calendar-limits-import).
export default function DayCalendar({
  day,
  bookings,
  onAddClick,
  onBookingClick,
}: {
  day: Date
  bookings: CalendarBooking[]
  onAddClick: () => void
  onBookingClick: (bookingId: string) => void
}) {
  const dayStr = day.toISOString().slice(0, 10)
  const dayBookings = useMemo(
    () => bookings.filter((b) => b.start_at.slice(0, 10) === dayStr).sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [bookings, dayStr],
  )

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--hp-text-primary)' }}>
          {day.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
        <button onClick={onAddClick} className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
          <Plus size={13} /> Đăng ký
        </button>
      </div>

      {dayBookings.length === 0 ? (
        <div className="py-8 text-center text-sm" style={{ color: 'var(--hp-text-desc)' }}>Chưa có đăng ký nào trong ngày này</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {dayBookings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBookingClick(b.id)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:opacity-90"
              style={{ background: 'var(--hp-neutral-bg)' }}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.resource?.color ?? 'var(--hp-primary)' }} />
              <span className="w-[100px] shrink-0 font-semibold">{b.start_at.slice(11, 16)}–{b.end_at.slice(11, 16)}</span>
              <span className="min-w-0 flex-1 truncate">{b.title}</span>
              <span className="shrink-0 text-xs" style={{ color: 'var(--hp-text-desc)' }}>{b.resource?.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
