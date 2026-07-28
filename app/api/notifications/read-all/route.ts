import { NextResponse } from 'next/server'
import { markAllNotificationsRead } from '@/lib/firestore/notifications'
import { requireSession } from '@/lib/session'

export async function PATCH() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await markAllNotificationsRead(session.uid)
  return NextResponse.json({ ok: true })
}
