import { NextResponse } from 'next/server'
import { listNotificationsForUser, toNotificationJson } from '@/lib/firestore/notifications'
import { requireSession } from '@/lib/session'

export async function GET() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const items = await listNotificationsForUser(session.uid)
  const notifications = items.map(toNotificationJson)
  const unreadCount = notifications.filter((n) => !n.is_read).length
  return NextResponse.json({ notifications, unreadCount })
}
