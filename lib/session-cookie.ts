import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/session-constants";

// Cookie phiên dùng CHUNG cho mọi subdomain *.hpcore.vn (account, pkd, itasset...)
// để đăng nhập 1 lần dùng mọi app (SSO). Local (localhost) để trống domain.
const IS_PROD = process.env.NODE_ENV === "production";
const SESSION_COOKIE_DOMAIN = IS_PROD ? ".hpcore.vn" : undefined;

/** Dựng chuỗi Set-Cookie thủ công để có thể phát NHIỀU Set-Cookie cùng tên
 *  (xoá cookie host-only cũ + đặt cookie .hpcore.vn) — tránh 2 cookie trùng tên
 *  gây đọc lẫn lộn / vòng lặp chuyển hướng. */
function setCookieStr(value: string, maxAgeSec: number, domain?: string): string {
  const parts = [`${SESSION_COOKIE_NAME}=${value}`, "Path=/", `Max-Age=${maxAgeSec}`, "HttpOnly", "SameSite=Lax"];
  if (domain) parts.push(`Domain=${domain}`);
  if (IS_PROD) parts.push("Secure");
  return parts.join("; ");
}

/** Áp 2 header Set-Cookie (xoá cookie host-only cũ + đặt cookie phiên mới dùng
 *  chung *.hpcore.vn) lên 1 NextResponse — dùng chung cho đăng nhập lần đầu
 *  (app/api/auth/session) và mint lại cookie sau khi thu hồi phiên khác
 *  (app/api/profile/revoke-other-sessions). */
export function appendSessionCookies(res: Response, sessionCookie: string): void {
  res.headers.append("Set-Cookie", setCookieStr("", 0, undefined));
  res.headers.append("Set-Cookie", setCookieStr(sessionCookie, SESSION_MAX_AGE_MS / 1000, SESSION_COOKIE_DOMAIN));
}

/** Xoá cookie phiên (đăng xuất) — cả biến thể host-only lẫn theo domain chung. */
export function appendClearSessionCookies(res: Response): void {
  res.headers.append("Set-Cookie", setCookieStr("", 0, undefined));
  res.headers.append("Set-Cookie", setCookieStr("", 0, SESSION_COOKIE_DOMAIN));
}
