import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { toUserJson } from '@/lib/firestore/users'
import BookingSidebar from '@/components/booking/BookingSidebar'

// Booking là 1 "app con" — có sidebar/thẩm mỹ riêng, KHÔNG dùng chung Sidebar
// 80px của app tổng (khác app/(dashboard)/layout.tsx). Route group riêng ở gốc
// app/ để tránh nested layout chồng lên Sidebar chung.
export default async function BookingLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = session.profile ? toUserJson(session.profile) : null

  return (
    <div className="flex h-screen" style={{ background: 'var(--booking-bg)' }}>
      <BookingSidebar user={profile} />
      <main className="min-w-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
