'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Bell, Check } from 'lucide-react'

type NotificationType =
  | 'booking_edited'
  | 'booking_approval'
  | 'booking_rejected'
  | 'booking_approved'
  | 'booking_cancelled'
  | 'comment_mention'
  | 'booking_upcoming'
  | 'booking_resource_closed'

type NotificationSettings = Record<NotificationType, boolean>

const LABELS: Record<NotificationType, { title: string; description: string }> = {
  booking_approval: { title: 'Cần tôi duyệt', description: 'Có đăng ký đang chờ bạn xét duyệt.' },
  booking_approved: { title: 'Đăng ký được duyệt', description: 'Đăng ký của bạn (hoặc bạn duyệt hộ) đã được chấp thuận.' },
  booking_rejected: { title: 'Đăng ký bị từ chối', description: 'Đăng ký của bạn bị từ chối, kèm lý do.' },
  booking_edited: { title: 'Đăng ký của tôi được sửa hộ', description: 'Người khác sửa hộ đăng ký của bạn.' },
  booking_cancelled: { title: 'Đăng ký của tôi bị huỷ hộ', description: 'Người khác huỷ hộ đăng ký của bạn.' },
  comment_mention: { title: 'Được nhắc tên (@mention)', description: 'Ai đó nhắc tên bạn trong bình luận.' },
  booking_upcoming: { title: 'Sắp đến giờ đăng ký', description: 'Đăng ký bạn tạo hoặc đang theo dõi sắp bắt đầu.' },
  booking_resource_closed: { title: 'Tài nguyên bị đóng', description: 'Tài nguyên bạn quản lý/theo dõi vừa bị đóng.' },
}

const ORDER: NotificationType[] = [
  'booking_approval',
  'booking_approved',
  'booking_rejected',
  'booking_edited',
  'booking_cancelled',
  'comment_mention',
  'booking_upcoming',
  'booking_resource_closed',
]

export default function NotificationSettingsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/notification-settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => { if (json?.settings) setSettings(json.settings) })
      .catch(() => {})
  }, [])

  async function toggle(type: NotificationType) {
    if (!settings) return
    const next = { ...settings, [type]: !settings[type] }
    setSettings(next)
    setSaved(false)
    const res = await fetch('/api/notification-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [type]: next[type] }),
    })
    if (res.ok) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  return (
    <div className="mx-auto max-w-[560px] p-6">
      <Link href="/bookings" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-[var(--hp-text-secondary)] hover:text-[var(--hp-text-primary)]">
        <ArrowLeft size={14} /> Quay lại
      </Link>

      <div className="mb-5 flex items-center gap-2">
        <Bell size={20} className="text-[var(--booking-primary)]" />
        <h1 className="text-[16px] font-semibold text-[var(--hp-text-primary)]">Cài đặt thông báo</h1>
      </div>
      <p className="mb-5 text-[13px] text-[var(--hp-text-secondary)]">
        Chọn loại thông báo bạn muốn nhận trên chuông. Loại bị tắt sẽ không được tạo mới cho bạn nữa.
      </p>

      {!settings ? (
        <p className="text-[13px] text-[var(--hp-text-secondary)]">Đang tải...</p>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--hp-border)] rounded-lg border border-[var(--hp-border)]">
          {ORDER.map((type) => {
            const { title, description } = LABELS[type]
            const enabled = settings[type]
            return (
              <div key={type} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-[var(--hp-text-primary)]">{title}</p>
                  <p className="text-[12px] text-[var(--hp-text-secondary)]">{description}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  aria-label={title}
                  onClick={() => toggle(type)}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    enabled ? 'bg-[var(--booking-primary)]' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                      enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {saved && (
        <p className="mt-3 flex items-center gap-1.5 text-[12px] text-[var(--hp-success)]">
          <Check size={14} /> Đã lưu
        </p>
      )}
    </div>
  )
}
