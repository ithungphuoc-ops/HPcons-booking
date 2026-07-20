import { NextResponse } from 'next/server'
import { Timestamp } from 'firebase-admin/firestore'
import * as XLSX from 'xlsx'
import { requireAdmin } from '@/lib/session'
import { listBookingPurposes } from '@/lib/firestore/bookingPurposes'
import { listBookingResources, createBooking } from '@/lib/firestore/bookings'

// dd/mm/yyyy hh:mm (mẫu cột đã xác nhận với Sếp) — nếu ô Excel là kiểu Ngày
// thật (không phải text), XLSX.read({cellDates:true}) đã trả sẵn Date, dùng
// luôn không cần parse chuỗi.
function parseVnDateTime(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})$/)
  if (!m) return null
  const [, d, mo, y, h, mi] = m
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi))
  return Number.isNaN(date.getTime()) ? null : date
}

// Nhập hàng loạt đăng ký từ Excel (chỉ admin, 20/07/2026) — cột: Tên tài
// nguyên, Tiêu đề, Mục đích, Bắt đầu, Kết thúc. Mỗi dòng xử lý ĐỘC LẬP (không
// bọc 1 transaction cho cả file — xem design.md Decision 6 của change
// booking-calendar-limits-import): dòng lỗi bị bỏ qua kèm lý do rõ ràng, các
// dòng đúng vẫn tạo bình thường qua createBooking() sẵn có (tái dùng nguyên
// transaction chặn trùng lịch, không viết lại logic).
export async function POST(req: Request) {
  const session = await requireAdmin().catch((e) => e as Error)
  if (session instanceof Error) return NextResponse.json({ error: session.message }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Thiếu tệp Excel' }, { status: 400 })

  let rows: Record<string, unknown>[]
  try {
    const buf = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
  } catch {
    return NextResponse.json({ error: 'Không đọc được tệp Excel — kiểm tra lại định dạng .xlsx/.xls' }, { status: 400 })
  }
  if (rows.length === 0) return NextResponse.json({ error: 'Tệp không có dòng dữ liệu nào' }, { status: 400 })

  const [resources, purposes] = await Promise.all([listBookingResources(), listBookingPurposes(true)])
  const resourceByName = new Map(resources.map((r) => [r.name.trim().toLowerCase(), r]))
  const purposeByName = new Map(purposes.map((p) => [p.name.trim().toLowerCase(), p]))

  let successCount = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // dòng 1 là header
    const row = rows[i]
    try {
      const resourceName = String(row['Tên tài nguyên'] ?? '').trim()
      const title = String(row['Tiêu đề'] ?? '').trim()
      const purposeRaw = String(row['Mục đích'] ?? '').trim()
      const startAt = parseVnDateTime(row['Bắt đầu'])
      const endAt = parseVnDateTime(row['Kết thúc'])

      if (!resourceName) throw new Error('Thiếu tên tài nguyên')
      if (!title) throw new Error('Thiếu tiêu đề')
      if (!startAt || !endAt) throw new Error('Ngày giờ không đúng định dạng dd/mm/yyyy hh:mm')
      if (endAt <= startAt) throw new Error('Giờ kết thúc phải sau giờ bắt đầu')

      const resource = resourceByName.get(resourceName.toLowerCase())
      if (!resource) throw new Error(`Không tìm thấy tài nguyên đang mở tên "${resourceName}"`)

      // Khớp mục đích theo tên (không phân biệt hoa/thường) nếu có cấu hình
      // sẵn; không khớp thì coi như "Khác" (mục đích tự do) — Excel không có
      // cột nhập từng trường tuỳ chỉnh của formSchema nên formData luôn rỗng.
      const matchedPurpose = purposeRaw ? purposeByName.get(purposeRaw.toLowerCase()) : undefined

      await createBooking(
        {
          resourceId: resource.id,
          userId: session.uid,
          title,
          purposeId: matchedPurpose?.id ?? null,
          purposeText: matchedPurpose ? null : purposeRaw || null,
          note: null,
          destination: null,
          passengers: null,
          quantity: null,
          startAt: Timestamp.fromDate(startAt),
          endAt: Timestamp.fromDate(endAt),
          attachments: [],
          formData: [],
        },
        { registrationType: resource.registrationType, bookingWindow: resource.bookingWindow },
      )
      successCount++
    } catch (e) {
      errors.push({ row: rowNum, message: (e as Error).message })
    }
  }

  return NextResponse.json({ successCount, errors })
}
