import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { toggleFollow } from '@/lib/firestore/bookings'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await toggleFollow(id, session.uid)
  return NextResponse.json(result)
}
