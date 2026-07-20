import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { toggleBookingPurpose, renameBookingPurpose, updateBookingPurposeFormSchema } from '@/lib/firestore/bookingPurposes'
import type { BookingFormField } from '@/lib/firestore/types'

const VALID_FIELD_TYPES = new Set(['text', 'textarea', 'number', 'date', 'select', 'multiselect', 'checkbox', 'file'])

function parseFormSchema(raw: unknown): BookingFormField[] {
  if (!Array.isArray(raw)) throw new Error('form_schema phải là mảng')
  return raw.map((f, i) => {
    if (!f || typeof f.id !== 'string' || typeof f.label !== 'string' || !f.label.trim()) {
      throw new Error(`Trường thứ ${i + 1} thiếu id hoặc nhãn`)
    }
    if (!VALID_FIELD_TYPES.has(f.type)) throw new Error(`Trường "${f.label}" có loại không hợp lệ`)
    return {
      id: f.id,
      label: f.label.trim(),
      type: f.type,
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.filter((o: unknown) => typeof o === 'string' && o.trim()) : undefined,
    }
  })
}

// Body có `name` → đổi tên (validate trùng tên, loại trừ chính mục đích đang
// sửa). Body có `form_schema` → lưu lại danh sách trường tuỳ chỉnh của mục
// đích (trình thiết kế biểu mẫu, 20/07/2026). Không có gì trong 2 cái trên →
// giữ hành vi cũ: bật/tắt (không xoá cứng — giữ lịch sử các booking đã dùng).
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

  if (body.form_schema !== undefined) {
    try {
      const formSchema = parseFormSchema(body.form_schema)
      await updateBookingPurposeFormSchema(id, formSchema)
      return NextResponse.json({ form_schema: formSchema })
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
