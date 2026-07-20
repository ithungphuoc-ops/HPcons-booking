import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { adminStorage } from '@/lib/firebase/admin'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5
const ALLOWED_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

// Tải tệp đính kèm CỦA TÀI NGUYÊN (khác hẳn tệp đính kèm của booking ở
// app/api/bookings/attachments/route.ts) — cho phép mọi session đăng nhập
// tải lên (20/07/2026, giống hệt route booking), vì bản thân việc tải tệp
// lên Storage không cấp quyền Firestore gì — quyền THẬT được kiểm tra ở bước
// PATCH /api/booking-resources/[id] sau đó (chỉ admin hoặc đúng managerId của
// tài nguyên mới gắn được attachments này vào tài nguyên). Cùng khuôn upload
// (FormData -> Storage -> URL), lưu theo path riêng `booking-resources/` để
// không lẫn với `bookings/`. Dùng session.uid trong path (không phải
// resourceId) vì tài nguyên có thể chưa tồn tại lúc tải (đang tạo mới).
export async function POST(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const files = form?.getAll('files').filter((f): f is File => f instanceof File) ?? []
  if (files.length === 0) return NextResponse.json({ error: 'Thiếu tệp' }, { status: 400 })
  if (files.length > MAX_FILES) return NextResponse.json({ error: `Tối đa ${MAX_FILES} tệp mỗi lần` }, { status: 400 })

  for (const file of files) {
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: `Loại tệp không hỗ trợ: ${file.name}` }, { status: 400 })
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: `Tệp "${file.name}" vượt quá 10MB` }, { status: 400 })
  }

  try {
    const uploaded: { name: string; url: string }[] = []
    for (const file of files) {
      const buf = Buffer.from(await file.arrayBuffer())
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `booking-resources/${session.uid}/${Date.now()}-${safeName}`
      const f = adminStorage.bucket().file(path)
      await f.save(buf, { contentType: file.type, resumable: false })
      const [url] = await f.getSignedUrl({ action: 'read', expires: '01-01-2500' })
      uploaded.push({ name: file.name, url })
    }
    return NextResponse.json({ attachments: uploaded })
  } catch (e) {
    return NextResponse.json({ error: 'Không tải được tệp: ' + (e as Error).message }, { status: 500 })
  }
}
