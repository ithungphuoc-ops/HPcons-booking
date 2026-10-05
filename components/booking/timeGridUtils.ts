// Tiện ích dùng chung cho lưới giờ của WeekCalendar.tsx và DayCalendar.tsx
// (change booking-week-day-timegrid, 02/10/2026). Tách riêng khỏi 2 component
// để DayCalendar không phải import từ WeekCalendar.

export const PX_PER_HOUR = 56
export const DEFAULT_START_HOUR = 6
export const DEFAULT_END_HOUR = 22
export const SNAP_MINUTES = 30
export const DEFAULT_DURATION_MINUTES = 60

export type TimeGridBooking = { start_at: string; end_at: string }

// Giờ:phút trong ngày của 1 mốc ISO dạng "...T HH:mm..." — chỉ đọc phần chuỗi,
// không parse Date/múi giờ (khớp cách MonthCalendar/WeekCalendar cũ đang làm).
export function minutesOfDay(iso: string): number {
  const hh = Number(iso.slice(11, 13))
  const mm = Number(iso.slice(14, 16))
  return hh * 60 + mm
}

// Đăng ký nhiều ngày hiện chỉ được xếp vào đúng ngày bắt đầu (giới hạn có sẵn
// từ trước, không đổi trong change này) — nếu end_at khác ngày start_at, coi
// như kết thúc lúc 24:00 của ngày đó để tính chiều cao, tránh âm/ra ngoài lưới.
export function clampedEndMinutes(b: TimeGridBooking): number {
  const sameDay = b.end_at.slice(0, 10) === b.start_at.slice(0, 10)
  return sameDay ? minutesOfDay(b.end_at) : 24 * 60
}

export function getTimeAxisBounds(
  bookings: TimeGridBooking[],
  defaultStartHour = DEFAULT_START_HOUR,
  defaultEndHour = DEFAULT_END_HOUR,
): { startHour: number; endHour: number } {
  let startHour = defaultStartHour
  let endHour = defaultEndHour
  for (const b of bookings) {
    const startH = Math.floor(minutesOfDay(b.start_at) / 60)
    const endH = Math.ceil(clampedEndMinutes(b) / 60)
    if (startH < startHour) startHour = startH
    if (endH > endHour) endHour = endH
  }
  startHour = Math.max(0, Math.min(startHour, 23))
  endHour = Math.min(24, Math.max(endHour, startHour + 1))
  return { startHour, endHour }
}

// Xếp các đăng ký trùng giờ cạnh nhau (column packing kiểu lịch Google) thay vì
// chồng đè. `col`/`colCount` dùng để tính left/width % khi vẽ.
export function packOverlappingEvents<T extends TimeGridBooking>(
  events: T[],
): Array<T & { col: number; colCount: number }> {
  const items = events
    .map((ev) => ({ ev, start: minutesOfDay(ev.start_at), end: clampedEndMinutes(ev) }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const out: Array<T & { col: number; colCount: number }> = []
  let group: Array<{ ev: T; col: number }> = []
  let columnEnds: number[] = []
  let groupEnd = -Infinity

  const flush = () => {
    const colCount = Math.max(1, columnEnds.length)
    for (const g of group) out.push({ ...g.ev, col: g.col, colCount })
    group = []
    columnEnds = []
    groupEnd = -Infinity
  }

  for (const item of items) {
    if (item.start >= groupEnd) flush()
    let col = columnEnds.findIndex((end) => end <= item.start)
    if (col === -1) { col = columnEnds.length; columnEnds.push(item.end) } else { columnEnds[col] = item.end }
    group.push({ ev: item.ev, col })
    groupEnd = Math.max(groupEnd, item.end)
  }
  flush()
  return out
}

export function timeToPixel(minutesOfDayValue: number, startHour: number, pxPerHour = PX_PER_HOUR): number {
  return (minutesOfDayValue - startHour * 60) * (pxPerHour / 60)
}

export function pixelToMinutes(y: number, startHour: number, pxPerHour = PX_PER_HOUR): number {
  return startHour * 60 + y / (pxPerHour / 60)
}

export function roundToStep(minutes: number, step = SNAP_MINUTES): number {
  return Math.round(minutes / step) * step
}

export function fmtHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = ((totalMinutes % 60) + 60) % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function toSlotIso(dateStr: string, totalMinutes: number): string {
  return `${dateStr}T${fmtHHMM(totalMinutes)}`
}

// Tính khung giờ mặc định (1 tiếng, làm tròn 30 phút) từ toạ độ Y bấm trong
// lưới giờ, không vượt biên startHour/endHour đang hiển thị.
export function computeSlotFromClickY(
  y: number,
  startHour: number,
  endHour: number,
): { startMin: number; endMin: number } {
  const raw = pixelToMinutes(y, startHour)
  const startMin = Math.min(Math.max(roundToStep(raw), startHour * 60), endHour * 60 - SNAP_MINUTES)
  const endMin = Math.min(startMin + DEFAULT_DURATION_MINUTES, endHour * 60)
  return { startMin, endMin }
}
