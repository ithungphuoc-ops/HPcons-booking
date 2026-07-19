import { NextResponse } from 'next/server'
import { requireSession, isAdmin } from '@/lib/session'
import { getCommentById, updateCommentText, deleteComment } from '@/lib/firestore/comments'

// Sửa nội dung — chỉ tác giả.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const comment = await getCommentById(id)
  if (!comment) return NextResponse.json({ error: 'Không tìm thấy bình luận' }, { status: 404 })
  if (comment.authorId !== session.uid) {
    return NextResponse.json({ error: 'Chỉ tác giả mới sửa được bình luận này' }, { status: 403 })
  }

  const body = await req.json()
  if (!body.text?.trim()) return NextResponse.json({ error: 'Nội dung không được để trống' }, { status: 400 })

  await updateCommentText(id, body.text.trim())
  return NextResponse.json({ ok: true })
}

// Xóa — tác giả HOẶC Admin/Owner (kiểm duyệt).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const comment = await getCommentById(id)
  if (!comment) return NextResponse.json({ error: 'Không tìm thấy bình luận' }, { status: 404 })
  if (comment.authorId !== session.uid && !isAdmin(session)) {
    return NextResponse.json({ error: 'Không có quyền xóa bình luận này' }, { status: 403 })
  }

  await deleteComment(id)
  return NextResponse.json({ ok: true })
}
