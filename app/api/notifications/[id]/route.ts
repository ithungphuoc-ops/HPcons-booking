import { NextResponse } from 'next/server'
import { getNotificationById, markNotificationRead } from '@/lib/firestore/notifications'
import { requireSession } from '@/lib/session'

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const notification = await getNotificationById(id)
  if (!notification) return NextResponse.json({ error: 'Không tìm thấy thông báo.' }, { status: 404 })
  if (notification.userId !== session.uid) {
    return NextResponse.json({ error: 'Không có quyền với thông báo này.' }, { status: 403 })
  }

  await markNotificationRead(id)
  return NextResponse.json({ ok: true })
}
