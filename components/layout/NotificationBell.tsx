'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'

type Notification = {
  id: string
  title: string
  body: string | null
  link: string | null
  type: string
  is_read: boolean
  created_at: string
}

const fmtRelative = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'Vừa xong'
  if (min < 60) return `${min} phút trước`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} giờ trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export default function NotificationBell({ label }: { label?: string } = {}) {
  const router = useRouter()
  const [items, setItems] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const json = await res.json()
    setItems(json.notifications ?? [])
    setUnreadCount(json.unreadCount ?? 0)
  }, [])

  useEffect(() => {
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' })
      load()
    }
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'PATCH' })
    load()
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className={label
          ? `relative w-full flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
              open ? 'bg-[#1B75BB]/10 text-[#1B75BB]' : 'text-gray-600 hover:bg-gray-50'
            }`
          : `relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${
              open ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-700'
            }`
        }
      >
        <Bell size={label ? 18 : 19} />
        {label && <span className="flex-1 text-left">{label}</span>}
        {unreadCount > 0 && (
          <span className={label
            ? 'min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center'
            : 'absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white'
          }>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-full ml-2 top-0 w-80 max-h-96 overflow-y-auto bg-white border border-gray-100 rounded-xl shadow-lg z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="font-semibold text-sm text-gray-900">Thông báo</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-blue-600 hover:underline">
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-10">Chưa có thông báo nào</p>
          ) : items.map(n => (
            <button
              key={n.id}
              onClick={() => handleClick(n)}
              className={`block w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/60' : ''}`}
            >
              <p className="text-sm font-medium text-gray-900">{n.title}</p>
              {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
              <p className="text-[11px] text-gray-400 mt-1">{fmtRelative(n.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
