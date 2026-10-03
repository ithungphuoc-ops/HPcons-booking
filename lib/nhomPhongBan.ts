/**
 * Luật nhóm theo PHÒNG BAN (thay "Nhóm thành viên" memberGroups — Sếp bỏ hẳn
 * 03/10/2026). HÀM THUẦN, không đọc Firestore: nhận danh sách phòng ban /
 * người dùng đã đọc sẵn (cache) để kiểm bằng dữ liệu giả được.
 *
 * - Danh sách "quản lý để chọn nhanh" = tập trưởng đơn vị (departments.leaderId).
 * - @nhóm trong bình luận = phòng ban: gồm người có đơn vị chính
 *   (users.departmentId) HOẶC kiêm nhiệm (users.secondaryDepartmentIds) là
 *   phòng ban đó hoặc bất kỳ nhóm con nào của nó (đi theo parentId, tối đa
 *   MAX_PARENT_STEPS tầng, chặn vòng lặp).
 */
import { MAX_PARENT_STEPS } from "@/lib/quanLyTrucTiep";

export interface PhongBanToiThieu {
  id: string;
  leaderId?: string | null;
  parentId?: string | null;
}

export interface NguoiDungToiThieu {
  id: string;
  departmentId?: string | null;
  secondaryDepartmentIds?: unknown;
}

/** Trưởng đơn vị của mọi phòng ban — không trùng, bỏ rỗng, giữ thứ tự gặp đầu tiên. */
export function danhSachTruongDonVi(depts: PhongBanToiThieu[]): string[] {
  const out: string[] = [];
  for (const d of depts) {
    const id = typeof d.leaderId === "string" ? d.leaderId.trim() : "";
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

/**
 * Phòng ban gốc + mọi nhóm con/cháu (theo parentId), tối đa MAX_PARENT_STEPS
 * tầng dưới gốc. Gốc không tồn tại → tập rỗng. Vòng lặp parentId không treo
 * nhờ tập đã thăm.
 */
export function phongBanVaNhomCon(rootId: string, depts: PhongBanToiThieu[]): Set<string> {
  const ketQua = new Set<string>();
  if (!depts.some((d) => d.id === rootId)) return ketQua;

  const conTheoCha = new Map<string, string[]>();
  for (const d of depts) {
    if (!d.parentId) continue;
    const arr = conTheoCha.get(d.parentId) ?? [];
    arr.push(d.id);
    conTheoCha.set(d.parentId, arr);
  }

  ketQua.add(rootId);
  let tang = [rootId];
  for (let i = 0; i < MAX_PARENT_STEPS && tang.length > 0; i++) {
    const tangSau: string[] = [];
    for (const id of tang) {
      for (const con of conTheoCha.get(id) ?? []) {
        if (ketQua.has(con)) continue;
        ketQua.add(con);
        tangSau.push(con);
      }
    }
    tang = tangSau;
  }
  return ketQua;
}

/**
 * Bung @phòng-ban thành danh sách uid: đơn vị chính hoặc kiêm nhiệm thuộc
 * phòng ban đó / nhóm con. Không trùng người. Id không phải phòng ban (vd id
 * "Nhóm thành viên" cũ) → [] (không lỗi).
 */
export function thanhVienPhongBan(
  rootId: string,
  depts: PhongBanToiThieu[],
  users: NguoiDungToiThieu[],
): string[] {
  const tapPhongBan = phongBanVaNhomCon(rootId, depts);
  if (tapPhongBan.size === 0) return [];
  const out = new Set<string>();
  for (const u of users) {
    const kiemNhiem = Array.isArray(u.secondaryDepartmentIds) ? u.secondaryDepartmentIds : [];
    if (
      (u.departmentId && tapPhongBan.has(u.departmentId)) ||
      kiemNhiem.some((id) => typeof id === "string" && tapPhongBan.has(id))
    ) {
      out.add(u.id);
    }
  }
  return Array.from(out);
}
