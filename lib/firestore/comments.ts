import "server-only";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getUserById } from "./users";
import { createNotifications } from "./notifications";
import type { FirestoreComment } from "./types";

const COLLECTION = "comments";

export interface CommentWithId extends FirestoreComment {
  id: string;
}

// Chỉ lọc entityId == trên Firestore (1 field, tự động có index) — lọc
// entityType + sắp xếp createdAt ở code, tránh cần composite index (bài học
// lặp lại 2 lần trong ngày ở module Booking, xem lib/firestore/bookings.ts).
export async function listComments(entityType: string, entityId: string): Promise<CommentWithId[]> {
  const snap = await adminDb.collection(COLLECTION).where("entityId", "==", entityId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as FirestoreComment) }))
    .filter((c) => c.entityType === entityType)
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function getCommentById(id: string): Promise<CommentWithId | null> {
  const snap = await adminDb.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...(snap.data() as FirestoreComment) };
}

export async function createComment(data: {
  entityType: string;
  entityId: string;
  authorId: string;
  text: string;
  mentionIds: string[];
  parentId: string | null;
}): Promise<CommentWithId> {
  const doc: FirestoreComment = { ...data, createdAt: Timestamp.now(), editedAt: null };
  const ref = await adminDb.collection(COLLECTION).add(doc);
  return { id: ref.id, ...doc };
}

export async function updateCommentText(id: string, text: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).update({ text, editedAt: Timestamp.now() });
}

export async function deleteComment(id: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(id).delete();
}

// Giãn mentionIds thành thông báo — mỗi id thử tra users trước, không có
// thì memberGroups, rồi departments (đúng thứ tự design.md Decision 5).
// Loại trùng nếu 1 người vừa được mention trực tiếp vừa nằm trong nhóm được mention.
async function resolveMentionToUserIds(mentionId: string): Promise<string[]> {
  const user = await getUserById(mentionId);
  if (user) return [mentionId];

  const groupSnap = await adminDb.collection("memberGroups").doc(mentionId).get();
  if (groupSnap.exists) {
    const memberIds = groupSnap.data()?.memberIds;
    return Array.isArray(memberIds) ? memberIds : [];
  }

  const deptSnap = await adminDb.collection("departments").doc(mentionId).get();
  if (deptSnap.exists) {
    const usersSnap = await adminDb.collection("users").where("departmentId", "==", mentionId).get();
    return usersSnap.docs.map((d) => d.id);
  }

  return [];
}

export async function notifyCommentMentions(comment: CommentWithId, authorName: string): Promise<void> {
  if (comment.mentionIds.length === 0) return;

  const expanded = await Promise.all(comment.mentionIds.map(resolveMentionToUserIds));
  const uniqueUserIds = Array.from(new Set(expanded.flat())).filter((id) => id !== comment.authorId);
  if (uniqueUserIds.length === 0) return;

  await createNotifications(
    uniqueUserIds.map((userId) => ({
      userId,
      title: "Có người nhắc đến bạn trong bình luận",
      body: `${authorName}: ${comment.text.slice(0, 140)}`,
      link: comment.entityType === "booking" ? `/bookings?open=${comment.entityId}` : null,
      type: "comment_mention",
    })),
  );
}

export function toCommentJson(c: CommentWithId, userMap: Map<string, { full_name: string }>) {
  return {
    id: c.id,
    entity_type: c.entityType,
    entity_id: c.entityId,
    author_id: c.authorId,
    author_name: userMap.get(c.authorId)?.full_name ?? c.authorId,
    text: c.text,
    mention_ids: c.mentionIds,
    parent_id: c.parentId,
    created_at: c.createdAt?.toDate?.().toISOString() ?? null,
    edited_at: c.editedAt?.toDate?.().toISOString() ?? null,
  };
}
