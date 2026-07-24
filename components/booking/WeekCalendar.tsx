'use client'

import { useMemo } from 'react'
import type { CalendarBooking } from './MonthCalendar'

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Thứ Hai của tuần chứa `date` — quy ước tuần bắt đầu Thứ Hai, đồng nhất với MonthCalendar.
export function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const weekdayMon = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - weekdayMon)
  d.setHours(0, 0, 0, 0)
  return d
}

export function getWeekRange(date: Date): { from: Date; to: Date } {
  const from = getWeekStart(date)
  const to = new Date(from)
  to.setDate(to.getDate() + 7)
  return { from, to }
}

// View Tuần — liệt kê ĐẦY ĐỦ (không giới hạn 3 dòng như Tháng), đủ dùng để
// xem chi tiết hơn mà không cần lưới giờ phức tạp (xem design.md Decision 4
// của change booking-calendar-limits-import).
export default function WeekCalendar({
  weekStart,
  bookings,
  onDayClick,
  onBookingClick,
}: {
  weekStart: Date
  bookings: CalendarBooking[]
  onDayClick: (dateStr: string) => void
  onBookingClick: (bookingId: string) => void
}) {
  const todayStr = toDateStr(new Date())
  const days = useMemo(() => {
    const out: Date[] = []
    for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(d.getDate() + i); out.push(d) }
    return out
  }, [weekStart])

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>()
    for (const b of bookings) {
      const key = b.start_at.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(b)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start_at.localeCompare(b.start_at))
    return map
  }, [bookings])

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl sm:grid-cols-7" style={{ background: 'var(--hp-border)' }}>
      {days.map((d) => {
        const dateStr = toDateStr(d)
        const isToday = dateStr === todayStr
        const dayBookings = bookingsByDay.get(dateStr) ?? []
        return (
          <div
            key={dateStr}
            onClick={() => onDayClick(dateStr)}
            className="flex min-h-[300px] cursor-pointer flex-col gap-1.5 p-2.5"
            style={{ background: isToday ? 'var(--hp-primary-bg)' : 'var(--hp-card)' }}
          >
            <div className="mb-1 text-sm font-bold uppercase" style={{ color: isToday ? 'var(--hp-primary)' : 'var(--hp-text-desc)' }}>
              {WEEKDAYS[(d.getDay() + 6) % 7]} · {d.getDate()}/{d.getMonth() + 1}
            </div>
            <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
              {dayBookings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onBookingClick(b.id) }}
                  className="truncate rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-white"
                  style={{ background: b.resource?.color ?? 'var(--hp-primary)' }}
                  title={`${b.start_at.slice(11, 16)} ${b.title}`}
                >
                  {b.start_at.slice(11, 16)} {b.title}
                </button>
              ))}
              {dayBookings.length === 0 && <span className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>—</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
