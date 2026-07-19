'use client'

import { useMemo } from 'react'

export type CalendarBooking = {
  id: string
  title: string
  start_at: string
  end_at: string
  status: string
  resource: { id: string; group_id: string; name: string; color: string } | null
}

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ Nhật']

function toDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Lưới tuần bắt đầu từ Thứ Hai, số hàng co giãn đúng theo tháng (không cố định 6 hàng).
function getMonthGridDays(month: Date): Date[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const firstWeekdayMon = (firstOfMonth.getDay() + 6) % 7
  const gridStart = new Date(firstOfMonth)
  gridStart.setDate(firstOfMonth.getDate() - firstWeekdayMon)

  const lastOfMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const lastWeekdayMon = (lastOfMonth.getDay() + 6) % 7
  const gridEnd = new Date(lastOfMonth)
  gridEnd.setDate(lastOfMonth.getDate() + (6 - lastWeekdayMon))

  const days: Date[] = []
  const cur = new Date(gridStart)
  while (cur <= gridEnd) {
    days.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// Dùng ở trang cha để tải đúng khoảng ngày đang hiển thị (kể cả ngày tràn tháng liền kề).
export function getMonthGridRange(month: Date): { from: Date; to: Date } {
  const days = getMonthGridDays(month)
  const from = days[0]
  const to = new Date(days[days.length - 1])
  to.setDate(to.getDate() + 1)
  return { from, to }
}

export default function MonthCalendar({
  month,
  bookings,
  onDayClick,
  onBookingClick,
}: {
  month: Date
  bookings: CalendarBooking[]
  onDayClick: (dateStr: string) => void
  onBookingClick: (bookingId: string) => void
}) {
  const todayStr = toDateStr(new Date())
  const days = useMemo(() => getMonthGridDays(month), [month])

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
    <div>
      <div className="hidden sm:grid sm:grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--hp-text-desc)' }}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl sm:grid-cols-7" style={{ background: 'var(--hp-border)' }}>
        {days.map((d) => {
          const dateStr = toDateStr(d)
          const inMonth = d.getMonth() === month.getMonth()
          const isToday = dateStr === todayStr
          const dayBookings = bookingsByDay.get(dateStr) ?? []
          const visible = dayBookings.slice(0, 3)
          const extra = dayBookings.length - visible.length

          return (
            <div
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              className="flex min-h-[64px] cursor-pointer flex-col gap-1 p-1.5 transition hover:opacity-90 sm:min-h-[104px]"
              style={{
                background: isToday ? 'var(--hp-primary-bg)' : 'var(--hp-card)',
                backgroundImage: !inMonth
                  ? 'repeating-linear-gradient(45deg, rgba(120,130,140,0.08), rgba(120,130,140,0.08) 6px, transparent 6px, transparent 12px)'
                  : undefined,
              }}
            >
              <div className="flex items-center justify-between sm:block">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    background: isToday ? 'var(--hp-primary)' : 'transparent',
                    color: isToday ? '#fff' : inMonth ? 'var(--hp-text-primary)' : 'var(--hp-text-desc)',
                  }}
                >
                  {d.getDate()}
                </span>
                <span className="text-[11px] font-medium sm:hidden" style={{ color: 'var(--hp-text-desc)' }}>
                  {WEEKDAYS[(d.getDay() + 6) % 7]}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-1">
                {visible.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onBookingClick(b.id) }}
                    className="truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white"
                    style={{ background: b.resource?.color ?? 'var(--hp-primary)' }}
                    title={`${b.start_at.slice(11, 16)} ${b.title}`}
                  >
                    {b.start_at.slice(11, 16)} {b.title}
                  </button>
                ))}
                {extra > 0 && (
                  <span className="text-[11px] font-medium" style={{ color: 'var(--hp-text-desc)' }}>
                    +{extra} khác
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
