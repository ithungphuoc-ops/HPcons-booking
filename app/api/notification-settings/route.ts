import { NextResponse } from 'next/server'
import { getNotificationSettings, updateNotificationSettings, type NotificationSettings } from '@/lib/server/notificationSettings'
import { requireSession } from '@/lib/session'

export async function GET() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getNotificationSettings(session.uid)
  return NextResponse.json({ settings })
}

export async function PATCH(request: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json()) as Partial<NotificationSettings>
  await updateNotificationSettings(session.uid, body)
  const settings = await getNotificationSettings(session.uid)
  return NextResponse.json({ settings })
}
