/**
 * Luật "Quản lý trực tiếp" (hợp đồng dữ liệu chung, Sếp duyệt 03/10/2026) —
 * HÀM THUẦN, không đọc Firestore, để kiểm bằng dữ liệu giả và dùng chung cho
 * server (lib/firestore/departments.ts) lẫn route chỉ đọc (/api/members).
 *
 *   1. Lần lượt từng id trong user.directManagerIds (đúng thứ tự): id khác
 *      chính mình và user đó tồn tại → trả id.
 *   2. Đi từ đơn vị chính (departmentId) lên nhóm cha (parentId), tối đa 10
 *      bước: trưởng đơn vị (leaderId) có và khác chính mình → trả leader.
 *   3. Không có ai → null.
 *
 * Mọi trường mới đều tuỳ chọn: dữ liệu cũ (không directManagerIds, không
 * parentId) cho đúng kết quả cũ = trưởng đơn vị chính.
 */

export const MAX_PARENT_STEPS = 10;

export interface UserQltt {
  departmentId?: string | null;
  directManagerIds?: unknown;
}

export interface DeptQltt {
  leaderId?: string | null;
  parentId?: string | null;
}

/** Lấy mảng directManagerIds hợp lệ (chuỗi, không rỗng, không trùng). */
export function docDirectManagerIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === "string" && v && !out.includes(v)) out.push(v);
  }
  return out;
}

type CoTheCho<T> = T | Promise<T>;

/**
 * Hàm luật duy nhất. Hàm tra cứu có thể đồng bộ (Map trong bộ nhớ — script
 * kiểm, /api/members) hoặc bất đồng bộ (đọc Firestore sống — duyệt booking),
 * nên chỉ có 1 bản luật, không chép 2 nơi.
 */
export async function resolveDirectManagerIdThuan(
  uid: string,
  user: UserQltt | null | undefined,
  userExists: (id: string) => CoTheCho<boolean>,
  getDept: (id: string) => CoTheCho<DeptQltt | null | undefined>,
): Promise<string | null> {
  if (!user) return null;

  for (const id of docDirectManagerIds(user.directManagerIds)) {
    if (id !== uid && (await userExists(id))) return id;
  }

  let d: string | null | undefined = user.departmentId;
  for (let i = 0; i < MAX_PARENT_STEPS; i++) {
    if (!d) break;
    const dept = await getDept(d);
    if (!dept) break;
    const leader = dept.leaderId;
    if (leader && leader !== uid) return leader;
    d = dept.parentId;
  }
  return null;
}
