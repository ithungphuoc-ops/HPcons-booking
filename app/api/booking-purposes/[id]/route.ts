import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { toggleBookingPurpose, renameBookingPurpose } from '@/lib/firestore/bookingPurposes'

// Body có `name` → đổi tên (validate trùng tên, loại trừ chính mục đích đang
// sửa). Không có `name` (kể cả không có body) → giữ hành vi cũ: bật/tắt
// (không xoá cứng — giữ lịch sử các booking đã dùng mục đích này).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin().catch((e) => e as Error)
  if (session instanceof Error) return NextResponse.json({ error: session.message }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => ({}))

  if (typeof body.name === 'string' && body.name.trim()) {
    try {
      await renameBookingPurpose(id, body.name.trim())
      return NextResponse.json({ name: body.name.trim() })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 })
    }
  }

  try {
    const isActive = await toggleBookingPurpose(id)
    return NextResponse.json({ is_active: isActive })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 404 })
  }
}
