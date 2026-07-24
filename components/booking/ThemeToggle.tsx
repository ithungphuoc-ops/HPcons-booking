'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

const STORAGE_KEY = 'booking-theme'

// Bật/tắt sáng-tối thủ công (20/07/2026) — lưu lựa chọn vào localStorage, áp
// dụng bằng cách gắn/gỡ class `.dark` trên <html> (đã có sẵn bộ token
// --hp-* cho cả 2 chế độ trong globals.css, chỉ thiếu cơ chế bật). Đọc trạng
// thái ban đầu từ class đã được set sẵn bởi script inline trong app/layout.tsx
// (tránh nháy sai theme lúc tải trang).
export default function ThemeToggle() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggle() {
    const next = !isDark
    setIsDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      className="hp-btn-ghost"
      aria-label="Đổi giao diện sáng/tối"
    >
      {isDark ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  )
}
