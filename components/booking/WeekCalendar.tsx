'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalendarBooking } from './MonthCalendar'
import { chipStyle, STATUS_LABEL } from './statusColors'
import {
  clampedEndMinutes,
  computeSlotFromClickY,
  fmtHHMM,
  getTimeAxisBounds,
  minutesOfDay,
  packOverlappingEvents,
  PX_PER_HOUR,
  timeToPixel,
  toSlotIso,
} from './timeGridUtils'

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

type Selection = { dateStr: string; startMin: number; endMin: number } | null

// View Tuần — lưới giờ trực quan (change booking-week-day-timegrid, 02/10/2026):
// thay cho danh sách chip theo giờ cũ. 1 cột ngày có thể chứa đăng ký của NHIỀU
// tài nguyên khác nhau (trang này gộp mọi tài nguyên, không phải trang riêng
// từng tài nguyên — xem design.md của change trên), nên các đăng ký trùng giờ
// được xếp cạnh nhau bằng packOverlappingEvents thay vì đè lên nhau.
export default function WeekCalendar({
  weekStart,
  bookings,
  onSlotClick,
  onBookingClick,
}: {
  weekStart: Date
  bookings: CalendarBooking[]
  onSlotClick: (dateStr: string, slot: { start: string; end: string }) => void
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

  // Biên giờ dùng CHUNG cho cả 7 cột (tính trên toàn bộ booking trong tuần) để
  // mọi ngày có cùng chiều cao trục giờ, dễ so sánh ngang hàng (design.md Decision 1/4).
  const { startHour, endHour } = useMemo(() => getTimeAxisBounds(bookings), [bookings])
  const totalHeight = (endHour - startHour) * PX_PER_HOUR
  const hourMarks = useMemo(() => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i), [startHour, endHour])

  const [selection, setSelection] = useState<Selection>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSelection(null) }, [weekStart])

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelection(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setSelection(null)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [])

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>, dateStr: string) {
    const target = e.target as HTMLElement
    if (target.closest('[data-booking-card]') || target.closest('[data-selection-box]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { startMin, endMin } = computeSlotFromClickY(e.clientY - rect.top, startHour, endHour)
    setSelection({ dateStr, startMin, endMin })
  }

  return (
    <div ref={rootRef} className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--hp-border)' }}>
      <div
        className="grid gap-px overflow-x-auto"
        style={{ gridTemplateColumns: '44px repeat(7, minmax(110px, 1fr))', background: 'var(--hp-border)' }}
      >
        <div style={{ background: 'var(--hp-card)' }} />
        {days.map((d) => {
          const dateStr = toDateStr(d)
          const isToday = dateStr === todayStr
          return (
            <div
              key={dateStr}
              className="flex items-center justify-center py-1.5 text-xs font-bold uppercase tracking-wide"
              style={{ background: isToday ? 'var(--hp-primary-bg)' : 'var(--hp-card)', color: isToday ? 'var(--hp-primary)' : 'var(--hp-text-desc)' }}
            >
              {WEEKDAYS[(d.getDay() + 6) % 7].slice(0, 3)} {d.getDate()}/{d.getMonth() + 1}
            </div>
          )
        })}

        <div className="relative" style={{ background: 'var(--hp-card)', height: totalHeight }}>
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 -translate-y-1/2 px-1 text-[10px]"
              style={{ top: (h - startHour) * PX_PER_HOUR, color: 'var(--hp-text-desc)' }}
            >
              {h}h
            </div>
          ))}
        </div>

        {days.map((d) => {
          const dateStr = toDateStr(d)
          const isToday = dateStr === todayStr
          const dayBookings = bookingsByDay.get(dateStr) ?? []
          const packed = packOverlappingEvents(dayBookings)
          const sel = selection?.dateStr === dateStr ? selection : null

          return (
            <div
              key={dateStr}
              className="relative cursor-crosshair"
              style={{ background: isToday ? 'var(--hp-primary-bg)' : 'var(--hp-card)', height: totalHeight }}
              onClick={(e) => handleGridClick(e, dateStr)}
            >
              {hourMarks.slice(0, -1).map((h) => (
                <div key={h} className="absolute left-0 right-0 border-t" style={{ top: (h - startHour) * PX_PER_HOUR, borderColor: 'var(--hp-border)', opacity: 0.6 }} />
              ))}

              {packed.map((b) => {
                const top = timeToPixel(minutesOfDay(b.start_at), startHour)
                const height = Math.max(timeToPixel(clampedEndMinutes(b), startHour) - top, 18)
                const widthPct = 100 / b.colCount
                return (
                  <button
                    key={b.id}
                    type="button"
                    data-booking-card
                    onClick={(e) => { e.stopPropagation(); onBookingClick(b.id) }}
                    className="absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[11px] font-semibold leading-tight text-white"
                    style={{
                      ...chipStyle(b.status, b.resource?.color),
                      top, height,
                      left: `calc(${widthPct * b.col}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                    title={`${b.start_at.slice(11, 16)}-${b.end_at.slice(11, 16)} ${b.title} · ${b.resource?.name ?? ''}${b.user?.department ? ' · ' + b.user.department : ''} (${STATUS_LABEL[b.status] ?? b.status})`}
                  >
                    <div className="truncate">{b.start_at.slice(11, 16)} {b.title}</div>
                    {height > 32 && <div className="truncate text-[10px] font-normal opacity-90">{b.resource?.name}</div>}
                  </button>
                )
              })}

              {sel && (
                <div
                  data-selection-box
                  className="absolute left-0.5 right-0.5 flex items-center justify-between gap-1 rounded-md border-2 border-dashed px-1.5"
                  style={{
                    top: timeToPixel(sel.startMin, startHour),
                    height: Math.max(timeToPixel(sel.endMin, startHour) - timeToPixel(sel.startMin, startHour), 20),
                    borderColor: 'var(--hp-primary)',
                    background: 'color-mix(in srgb, var(--hp-primary) 16%, transparent)',
                  }}
                >
                  <span className="truncate text-[10px] font-bold" style={{ color: 'var(--hp-primary)' }}>{fmtHHMM(sel.startMin)}–{fmtHHMM(sel.endMin)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSlotClick(dateStr, { start: toSlotIso(dateStr, sel.startMin), end: toSlotIso(dateStr, sel.endMin) })
                      setSelection(null)
                    }}
                    className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: 'var(--hp-primary)' }}
                    title="Tạo đăng ký trong khung giờ này"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
