'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
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

export function getDayRange(date: Date): { from: Date; to: Date } {
  const from = new Date(date); from.setHours(0, 0, 0, 0)
  const to = new Date(from); to.setDate(to.getDate() + 1)
  return { from, to }
}

type Selection = { startMin: number; endMin: number } | null

// View Ngày — lưới giờ trực quan (change booking-week-day-timegrid, 02/10/2026):
// thay cho danh sách sắp theo giờ cũ. Giữ nút "Đăng ký" ở đầu trang làm lối
// vào mặc định (08:00–09:00, như hành vi cũ) song song với bấm-chọn khung giờ
// trực tiếp trong lưới — xem tasks.md mục 3.4.
export default function DayCalendar({
  day,
  bookings,
  onSlotClick,
  onBookingClick,
}: {
  day: Date
  bookings: CalendarBooking[]
  onSlotClick: (dateStr: string, slot: { start: string; end: string }) => void
  onBookingClick: (bookingId: string) => void
}) {
  const dayStr = day.toISOString().slice(0, 10)
  const dayBookings = useMemo(
    () => bookings.filter((b) => b.start_at.slice(0, 10) === dayStr).sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [bookings, dayStr],
  )
  const { startHour, endHour } = useMemo(() => getTimeAxisBounds(dayBookings), [dayBookings])
  const totalHeight = (endHour - startHour) * PX_PER_HOUR
  const hourMarks = useMemo(() => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i), [startHour, endHour])
  const packed = useMemo(() => packOverlappingEvents(dayBookings), [dayBookings])

  const [selection, setSelection] = useState<Selection>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setSelection(null) }, [dayStr])

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

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement
    if (target.closest('[data-booking-card]') || target.closest('[data-selection-box]')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const { startMin, endMin } = computeSlotFromClickY(e.clientY - rect.top, startHour, endHour)
    setSelection({ startMin, endMin })
  }

  return (
    <div ref={rootRef} className="rounded-xl p-5" style={{ background: 'var(--hp-card)', border: '1px solid var(--hp-border)' }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-lg font-bold" style={{ color: 'var(--hp-text-primary)' }}>
          {day.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </span>
        <button
          onClick={() => onSlotClick(dayStr, { start: toSlotIso(dayStr, 8 * 60), end: toSlotIso(dayStr, 9 * 60) })}
          className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: 'var(--hp-primary)' }}
        >
          <Plus size={15} /> Đăng ký
        </button>
      </div>

      <div className="flex overflow-x-auto overflow-hidden rounded-lg" style={{ border: '1px solid var(--hp-border)' }}>
        <div className="relative flex-none" style={{ width: 48, borderRight: '1px solid var(--hp-border)', height: totalHeight }}>
          {hourMarks.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 -translate-y-1/2 px-1.5 text-[11px]"
              style={{ top: (h - startHour) * PX_PER_HOUR, color: 'var(--hp-text-desc)' }}
            >
              {h}h
            </div>
          ))}
        </div>

        <div className="relative min-w-[260px] flex-1 cursor-crosshair" style={{ height: totalHeight }} onClick={handleGridClick}>
          {hourMarks.slice(0, -1).map((h) => (
            <div key={h} className="absolute left-0 right-0 border-t" style={{ top: (h - startHour) * PX_PER_HOUR, borderColor: 'var(--hp-border)', opacity: 0.6 }} />
          ))}

          {dayBookings.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center text-sm" style={{ color: 'var(--hp-text-desc)' }}>
              Chưa có đăng ký nào trong ngày này — bấm vào khung giờ để tạo nhanh
            </div>
          )}

          {packed.map((b) => {
            const top = timeToPixel(minutesOfDay(b.start_at), startHour)
            const height = Math.max(timeToPixel(clampedEndMinutes(b), startHour) - top, 22)
            const widthPct = 100 / b.colCount
            return (
              <button
                key={b.id}
                type="button"
                data-booking-card
                onClick={(e) => { e.stopPropagation(); onBookingClick(b.id) }}
                className="absolute overflow-hidden rounded-md px-2 py-1 text-left text-white"
                style={{
                  ...chipStyle(b.status, b.resource?.color),
                  top, height,
                  left: `calc(${widthPct * b.col}% + 3px)`,
                  width: `calc(${widthPct}% - 6px)`,
                }}
                title={`${b.start_at.slice(11, 16)}-${b.end_at.slice(11, 16)} ${b.title} · ${b.resource?.name ?? ''}${b.user?.department ? ' · ' + b.user.department : ''} (${STATUS_LABEL[b.status] ?? b.status})`}
              >
                <div className="truncate text-[12px] font-semibold">{b.start_at.slice(11, 16)}–{b.end_at.slice(11, 16)} {b.title}</div>
                {height > 40 && <div className="truncate text-[11px] font-normal opacity-90">{b.resource?.name}</div>}
              </button>
            )
          })}

          {selection && (
            <div
              data-selection-box
              className="absolute left-1 right-1 flex items-center justify-between gap-2 rounded-md border-2 border-dashed px-2"
              style={{
                top: timeToPixel(selection.startMin, startHour),
                height: Math.max(timeToPixel(selection.endMin, startHour) - timeToPixel(selection.startMin, startHour), 24),
                borderColor: 'var(--hp-primary)',
                background: 'color-mix(in srgb, var(--hp-primary) 16%, transparent)',
              }}
            >
              <span className="text-xs font-bold" style={{ color: 'var(--hp-primary)' }}>{fmtHHMM(selection.startMin)}–{fmtHHMM(selection.endMin)}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSlotClick(dayStr, { start: toSlotIso(dayStr, selection.startMin), end: toSlotIso(dayStr, selection.endMin) })
                  setSelection(null)
                }}
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ background: 'var(--hp-primary)' }}
                title="Tạo đăng ký trong khung giờ này"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
