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
    <div className="rounded-xl p-5" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-lg font-bold" style={{ color: 'var(--hp-text-primary)' }}>
          {day.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
        <button onClick={onAddClick} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--hp-primary)' }}>
          <Plus size={15} /> Đăng ký
        </button>
      </div>

      {dayBookings.length === 0 ? (
        <div className="py-10 text-center text-base" style={{ color: 'var(--hp-text-desc)' }}>Chưa có đăng ký nào trong ngày này</div>
      ) : (
        <div className="flex flex-col gap-2">
          {dayBookings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => onBookingClick(b.id)}
              className="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-base hover:opacity-90"
              style={{ background: 'var(--hp-neutral-bg)' }}
            >
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: b.resource?.color ?? 'var(--hp-primary)' }} />
              <span className="w-[130px] shrink-0 font-bold">{b.start_at.slice(11, 16)}–{b.end_at.slice(11, 16)}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{b.title}</span>
              <span className="shrink-0 text-sm" style={{ color: 'var(--hp-text-desc)' }}>{b.resource?.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
