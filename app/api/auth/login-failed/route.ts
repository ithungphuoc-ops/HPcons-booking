import { NextResponse } from "next/server";
import { logLogin, getClientIp } from "@/lib/loginHistory";

/**
 * Ghi log 1 lượt ĐĂNG NHẬP THẤT BẠI xảy ra hoàn toàn ở phía trình duyệt (sai
 * mật khẩu, lỗi Google...) — TRƯỚC khi có idToken nên không thể xác thực
 * caller bằng Firebase (khác với /api/auth/session). Không có session để
 * check quyền, chỉ giới hạn độ dài input để tránh ghi rác.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 200) : null;

  if (!email) {
    return NextResponse.json({ error: "Thiếu email" }, { status: 400 });
  }

  await logLogin({
    uid: null,
    email,
    fullName: null,
    status: "failed",
    reason,
    ip: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true });
}
