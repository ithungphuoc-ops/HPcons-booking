import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/session'
import { listAllUsers } from '@/lib/firestore/users'
import {
  listComments,
  createComment,
  getCommentById,
  notifyCommentMentions,
  toCommentJson,
} from '@/lib/firestore/comments'

// Danh sách bình luận của 1 đối tượng (entityType + entityId). Chủ yếu dùng
// cho lần tải đầu — cập nhật tức thời sau đó đi qua onSnapshot phía client
// (xem components/comments/CommentThread.tsx), không qua route này.
export async function GET(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  if (!entityType || !entityId) return NextResponse.json({ error: 'Thiếu entity_type hoặc entity_id' }, { status: 400 })

  const [comments, users] = await Promise.all([listComments(entityType, entityId), listAllUsers()])
  const userMap = new Map(users.map((u) => [u.id, { full_name: u.fullName }]))
  return NextResponse.json(comments.map((c) => toCommentJson(c, userMap)))
}

// Tạo bình luận. parentId (nếu có) LUÔN được quy về bình luận GỐC — nếu
// client gửi parentId của 1 reply thì tự lấy parentId của chính reply đó
// (giữ đúng cấu trúc phẳng 1 cấp, xem design.md Decision 6).
export async function POST(req: Request) {
  const session = await requireSession().catch(() => null)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.entity_type || !body.entity_id || !body.text?.trim()) {
    return NextResponse.json({ error: 'Thiếu thông tin bắt buộc' }, { status: 400 })
  }

  let parentId: string | null = body.parent_id || null
  if (parentId) {
    const parent = await getCommentById(parentId)
    if (!parent) return NextResponse.json({ error: 'Không tìm thấy bình luận gốc' }, { status: 404 })
    if (parent.parentId) parentId = parent.parentId
  }

  const comment = await createComment({
    entityType: body.entity_type,
    entityId: body.entity_id,
    authorId: session.uid,
    text: body.text.trim(),
    mentionIds: Array.isArray(body.mention_ids) ? body.mention_ids : [],
    parentId,
  })

  const [users] = await Promise.all([listAllUsers()])
  const authorName = users.find((u) => u.id === session.uid)?.fullName ?? 'Một nhân viên'
  await notifyCommentMentions(comment, authorName)

  const userMap = new Map(users.map((u) => [u.id, { full_name: u.fullName }]))
  return NextResponse.json(toCommentJson(comment, userMap))
}
