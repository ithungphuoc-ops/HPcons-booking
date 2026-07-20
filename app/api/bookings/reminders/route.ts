import { NextResponse } from 'next/server'
import { listBookingsNeedingReminder, listBookingsStartingSoon, notifyBookingApprover, updateBooking } from '@/lib/firestore/bookings'
import { getUserById } from '@/lib/firestore/users'
import { createNotifications } from '@/lib/firestore/notifications'

const UPCOMING_WINDOW_HOURS = 24

// Cron (Vercel Cron, xem vercel.json) gọi route này định kỳ để gửi thông báo
// nhắc lại (Lớp 2) + leo thang cho người được ủy quyền tạm thời (Lớp 3).
// Xác thực bằng header 'x-cron-secret' so với biến môi trường CRON_SECRET
// (đặt trên Vercel Dashboard — không có giá trị mặc định để tránh lộ route).
export async function GET(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const overdue = await listBookingsNeedingReminder()
  const today = new Date().toISOString().slice(0, 10)
  let remindersSent = 0
  let delegatesNotified = 0

  for (const { booking, approval } of overdue) {
    await notifyBookingApprover(approval.approverId, booking, { reminder: true })
    remindersSent++

    const approver = await getUserById(approval.approverId)
    const delegation = approver?.settings?.delegation
    if (delegation && delegation.fromDate <= today && today <= delegation.toDate) {
      await notifyBookingApprover(delegation.delegateTo, booking, {
        reminder: true,
        onBehalfOfName: approver?.fullName ?? undefined,
      })
      delegatesNotified++
    }
  }

  // "Sắp tới giờ" (20/07/2026) — cron chạy 1 lần/ngày nên hiểu là "diễn ra
  // trong vòng 24h tới kể từ lúc cron chạy" (xem design.md Decision 2 của
  // change booking-notifications-audit-permissions). Báo cả người đặt lẫn
  // người theo dõi, đánh dấu remindedUpcoming để không nhắc trùng.
  const startingSoon = await listBookingsStartingSoon(UPCOMING_WINDOW_HOURS)
  let upcomingNotified = 0
  for (const booking of startingSoon) {
    const recipients = [booking.userId, ...booking.followerIds].filter((v, i, arr) => arr.indexOf(v) === i)
    await createNotifications(recipients.map((userId) => ({
      userId,
      title: 'Sắp đến giờ đăng ký',
      body: `"${booking.title}" sẽ diễn ra trong vòng ${UPCOMING_WINDOW_HOURS} giờ tới.`,
      link: `/bookings?open=${booking.id}`,
      type: 'booking_upcoming',
    })))
    await updateBooking(booking.id, { remindedUpcoming: true })
    upcomingNotified++
  }

  return NextResponse.json({ ok: true, remindersSent, delegatesNotified, upcomingNotified })
}
