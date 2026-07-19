'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot, type Timestamp } from 'firebase/firestore'
import { getFirebaseFirestore } from '@/lib/firebase/client'
import { Pencil, Trash2, Reply, Check, X } from 'lucide-react'
import CommentComposer, { type MentionOption } from './CommentComposer'

type RawComment = {
  id: string
  entityType: string
  entityId: string
  authorId: string
  text: string
  mentionIds: string[]
  parentId: string | null
  createdAt: Timestamp
}

// Khung bình luận dùng chung nhiều app (gắn theo entityType/entityId) —
// đọc real-time qua onSnapshot (Firestore client SDK), ghi qua app/api/comments/**.
// Chỉ lọc entityId == trên Firestore, lọc entityType ở code — tránh cần
// composite index (đúng pattern đã dùng ở lib/firestore/comments.ts).
export default function CommentThread({
  entityType,
  entityId,
  myUserId,
  isAdmin,
  people,
  groups,
}: {
  entityType: string
  entityId: string
  myUserId: string
  isAdmin: boolean
  people: MentionOption[]
  groups: MentionOption[]
}) {
  const [comments, setComments] = useState<RawComment[]>([])
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    const db = getFirebaseFirestore()
    const q = query(collection(db, 'comments'), where('entityId', '==', entityId))
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<RawComment, 'id'>) }))
        .filter((c) => c.entityType === entityType)
        .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
      setComments(rows)
    }, () => { /* rules chưa deploy hoặc lỗi mạng — im lặng, danh sách giữ rỗng */ })
    return () => unsub()
  }, [entityType, entityId])

  const roots = comments.filter((c) => !c.parentId)
  const repliesOf = (rootId: string) => comments.filter((c) => c.parentId === rootId)
  const authorName = (uid: string) => people.find((p) => p.id === uid)?.display ?? 'Nhân viên'
  const fmt = (ts: Timestamp) => ts?.toDate ? ts.toDate().toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

  async function post(text: string, mentionIds: string[], parentId: string | null) {
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, text, mention_ids: mentionIds, parent_id: parentId }),
    })
    setReplyTo(null)
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return
    await fetch(`/api/comments/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: editText.trim() }) })
    setEditingId(null)
  }

  async function remove(id: string) {
    if (!confirm('Xóa bình luận này?')) return
    await fetch(`/api/comments/${id}`, { method: 'DELETE' })
  }

  function Row({ c, isReply }: { c: RawComment; isReply?: boolean }) {
    const canEdit = c.authorId === myUserId
    const canDelete = c.authorId === myUserId || isAdmin
    const editing = editingId === c.id

    return (
      <div className="text-sm">
        <div className="flex items-center gap-2">
          <span className="font-semibold" style={{ color: 'var(--hp-primary)' }}>{authorName(c.authorId)}</span>
          <span className="text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>{fmt(c.createdAt)}</span>
        </div>
        {editing ? (
          <div className="mt-1 flex items-center gap-1.5">
            <input value={editText} onChange={(e) => setEditText(e.target.value)} className="hp-input flex-1 !py-1 text-xs" />
            <button onClick={() => saveEdit(c.id)} className="rounded p-1 text-white" style={{ background: 'var(--hp-primary)' }}><Check size={12} /></button>
            <button onClick={() => setEditingId(null)} style={{ color: 'var(--hp-text-desc)' }}><X size={12} /></button>
          </div>
        ) : (
          <div className="mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--hp-text-primary)' }}>{c.text}</div>
        )}
        {!editing && (
          <div className="mt-1 flex items-center gap-3 text-[11px]" style={{ color: 'var(--hp-text-desc)' }}>
            {!isReply && (
              <button type="button" onClick={() => setReplyTo(c.id)} className="flex items-center gap-1 hover:opacity-80"><Reply size={11} /> Trả lời</button>
            )}
            {canEdit && (
              <button type="button" onClick={() => { setEditingId(c.id); setEditText(c.text) }} className="flex items-center gap-1 hover:opacity-80"><Pencil size={11} /> Sửa</button>
            )}
            {canDelete && (
              <button type="button" onClick={() => remove(c.id)} className="flex items-center gap-1 hover:opacity-80" style={{ color: 'var(--hp-danger)' }}><Trash2 size={11} /> Xóa</button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {roots.length === 0 && <div className="text-xs" style={{ color: 'var(--hp-text-desc)' }}>Chưa có bình luận nào</div>}
      {roots.map((c) => (
        <div key={c.id}>
          <Row c={c} />
          {repliesOf(c.id).length > 0 && (
            <div className="ml-4 mt-2 space-y-2.5 border-l-2 pl-3" style={{ borderColor: 'var(--hp-border)' }}>
              {repliesOf(c.id).map((r) => <Row key={r.id} c={r} isReply />)}
            </div>
          )}
          {replyTo === c.id && (
            <div className="ml-4 mt-2">
              <CommentComposer people={people} groups={groups} placeholder="Trả lời..." autoFocus onSubmit={(text, ids) => post(text, ids, c.id)} />
            </div>
          )}
        </div>
      ))}
      <CommentComposer people={people} groups={groups} onSubmit={(text, ids) => post(text, ids, null)} />
    </div>
  )
}
