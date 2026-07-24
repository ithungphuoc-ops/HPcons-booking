import type { CSSProperties } from 'react'

// Mã màu 2 lớp cho chip booking trên lịch (20/07/2026): NỀN theo trạng thái
// duyệt (để ai cũng phân biệt ngay đã duyệt hay còn chờ), VẠCH TRÁI theo màu
// tài nguyên (giữ nhận diện phòng/xe như trước). Dùng chung cho MonthCalendar/
// WeekCalendar/DayCalendar — tránh lặp lại logic màu ở 3 nơi.
export const STATUS_BG: Record<string, string> = {
  pending: 'var(--hp-warning)',
  approved: 'var(--hp-success)',
  rejected: 'var(--hp-danger)',
  cancelled: 'var(--hp-neutral)',
}

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  cancelled: 'Đã huỷ',
}

// Bản mờ hơn của STATUS_BG — dùng cho nền cả 1 hàng/danh sách (view Ngày),
// tương phản nhẹ hơn so với chip đặc trên lịch Tháng/Tuần.
export const STATUS_BG_SOFT: Record<string, string> = {
  pending: 'var(--hp-warning-bg)',
  approved: 'var(--hp-success-bg)',
  rejected: 'var(--hp-danger-bg)',
  cancelled: 'var(--hp-neutral-bg)',
}

export const STATUS_TEXT_SOFT: Record<string, string> = {
  pending: 'var(--hp-warning-soft)',
  approved: 'var(--hp-success-soft)',
  rejected: 'var(--hp-danger-soft)',
  cancelled: 'var(--hp-text-desc)',
}

export function chipStyle(status: string, resourceColor?: string | null): CSSProperties {
  return {
    background: STATUS_BG[status] ?? 'var(--hp-primary)',
    borderLeft: `4px solid ${resourceColor ?? 'rgba(255,255,255,0.6)'}`,
  }
}
