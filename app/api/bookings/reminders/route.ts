import { NextResponse } from 'next/server'
import { listBookingsNeedingReminder, notifyBookingApprover } from '@/lib/firestore/bookings'
import { getUserById } from '@/lib/firestore/users'

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

  return NextResponse.json({ ok: true, remindersSent, delegatesNotified })
}
