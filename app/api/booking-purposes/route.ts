import { NextResponse } from 'next/server'
import { requireSession, isAdmin } from '@/lib/session'
import { listAllUsers } from '@/lib/firestore/users'
import {
  listBookingPurposes,
  createBookingPurpose,
  countBookingUsageByPurpose,
  toBookingPurposeJson,
} from '@/lib/firestore/bookingPurposes'

export async function GET() {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [purposes, users, counts] = await Promise.all([
    listBookingPurposes(isAdmin(session)),
    listAllUsers(),
    countBookingUsageByPurpose(),
  ])
  const userMap = new Map(users.map((u) => [u.id, u.fullName]))

  return NextResponse.json(
    purposes.map((p) => toBookingPurposeJson(p, p.createdBy ? userMap.get(p.createdBy) ?? null : null, counts.get(p.id) ?? 0)),
  )
}

export async function POST(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session)) return NextResponse.json({ error: 'Chỉ admin mới được tạo mục đích' }, { status: 403 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Tên mục đích không được để trống' }, { status: 400 })

  try {
    const purpose = await createBookingPurpose(body.name.trim(), session.uid)
    return NextResponse.json(toBookingPurposeJson(purpose, null, 0))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }
}
