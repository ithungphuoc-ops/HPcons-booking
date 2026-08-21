'use client'

// Popup "Quà của tôi" — khung điện thoại nhúng iframe quacuatoi.hpcore.vn,
// phỏng theo GiftPopup.tsx đã duyệt ở hpcons-portal nhưng thích ứng theo
// đúng token màu/breakpoint RIÊNG của app Booking (không dùng --hp-primary
// của app tổng — xem app/globals.css §Booking, và app này chỉ dùng breakpoint
// sm/md, không có xl như bên portal).
import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, RotateCw, ExternalLink, Home, Bell, User, type LucideIcon } from 'lucide-react'

const QUA_CUA_TOI_URL = 'https://quacuatoi.hpcore.vn'
// Trang tài khoản dùng chung của App Tổng — đã dùng ở AppLauncher.tsx ("Tài khoản").
const HPCORE_PROFILE_URL = 'https://account.hpcore.vn/profile'

function MucDieuHuong({
  icon: Icon, label, title, onClick, noiBat,
}: { icon: LucideIcon; label: string; title?: string; onClick: () => void; noiBat?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors active:scale-95 ${
        noiBat ? 'text-[var(--booking-primary)]' : 'text-[#7c858d] hover:text-[#20272d]'
      }`}
    >
      <Icon size={20} />
      <span>{label}</span>
    </button>
  )
}

export default function GiftPopup({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const veTrangChu = () => { onClose(); router.push('/bookings') }
  const veThongBao = () => { onClose(); router.push('/bookings/settings/notifications') }
  const veTaiKhoan = () => { onClose(); window.location.href = HPCORE_PROFILE_URL }

  useEffect(() => {
    dialogRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = '' }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center md:p-4"
      style={{ background: 'rgba(6, 31, 23, 0.6)', backdropFilter: 'blur(3px)' }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Quà của tôi"
        tabIndex={-1}
        className="relative shadow-2xl w-full h-full rounded-none p-0 outline-none md:rounded-[3rem] md:p-3.5 md:w-[380px] md:h-[min(800px,88vh)]"
        style={{ background: 'linear-gradient(155deg, #2a3040, #12151c)' }}
      >
        <button
          onClick={onClose}
          aria-label="Đóng"
          className="hidden md:flex absolute -top-3.5 -right-3.5 w-10 h-10 rounded-full bg-white text-[#20272d] border border-[var(--booking-border)] shadow-lg items-center justify-center hover:scale-105 transition-transform"
        >
          <X size={18} />
        </button>
        <div className="relative w-full h-full bg-white overflow-hidden flex flex-col rounded-none md:rounded-[2.25rem]">
          <div className="flex md:hidden shrink-0 items-center justify-between gap-2 px-4 py-3 border-b border-[var(--booking-border)] bg-white">
            <span className="text-sm font-bold text-[#20272d]">🎁 Quà của tôi</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng"
              className="w-9 h-9 rounded-full bg-[var(--booking-bg)] text-[#7c858d] flex items-center justify-center hover:bg-[var(--booking-border)] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="relative h-11 shrink-0 bg-white hidden md:block">
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[118px] h-[26px] rounded-full bg-[#12151c] flex items-center justify-end pr-2.5">
              <span className="w-2 h-2 rounded-full bg-[#2a3040]" />
            </div>
          </div>
          <iframe
            ref={iframeRef}
            src={QUA_CUA_TOI_URL}
            title="Quà của tôi — điểm thưởng"
            className="flex-1 w-full border-0"
            loading="lazy"
          />
          <div className="grid grid-cols-5 shrink-0 border-t border-[var(--booking-border)] bg-white">
            <MucDieuHuong icon={Home} label="Trang chủ" onClick={veTrangChu} />
            <MucDieuHuong
              icon={RotateCw}
              label="Làm mới"
              onClick={() => { if (iframeRef.current) iframeRef.current.src = QUA_CUA_TOI_URL }}
            />
            <MucDieuHuong
              icon={ExternalLink}
              label="Mở tab"
              title="Mở tab đầy đủ"
              noiBat
              onClick={() => window.open(QUA_CUA_TOI_URL, '_blank', 'noopener,noreferrer')}
            />
            <MucDieuHuong icon={Bell} label="Thông báo" onClick={veThongBao} />
            <MucDieuHuong icon={User} label="Tôi" onClick={veTaiKhoan} />
          </div>
          <div className="relative h-5 shrink-0 bg-white hidden md:block">
            <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[120px] h-1 rounded-full bg-[#20272d]/20" />
          </div>
        </div>
      </div>
    </div>
  )
}
