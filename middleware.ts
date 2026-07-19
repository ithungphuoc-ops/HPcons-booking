import { NextRequest, NextResponse } from "next/server";

// Inline thay vì import từ "@/lib/session-constants" — import path-alias vào
// Edge Function (middleware) từng gây lỗi build "unsupported modules" trên
// Vercel cho project này (không rõ nguyên nhân chính xác, đây là workaround).
// Phải khớp đúng giá trị SESSION_COOKIE_NAME trong lib/session-constants.ts.
const SESSION_COOKIE_NAME = "session";

// File tĩnh trong public/ (ảnh, logo, font...) không cần đăng nhập
const STATIC_FILE_RE = /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/i;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Chỉ kiểm tra cookie có tồn tại hay không (không verify chữ ký ở đây) —
  // gọi firebase-admin trong Middleware làm build lỗi ERR_REQUIRE_ESM trên Vercel.
  // Verify thật sự (verifySessionCookie) đã có sẵn trong getSession() ở
  // dashboard layout (Server Component chạy Node.js serverless bình thường).
  const isLoggedIn = !!request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isAuthPage = pathname.startsWith("/login");
  const isPublicPage = pathname === "/" || pathname.startsWith("/auth/");
  const isStaticFile = STATIC_FILE_RE.test(pathname);

  if (!isLoggedIn && !isAuthPage && !isPublicPage && !isStaticFile) {
    // Giữ lại nơi định đến (vd /bookings) qua ?next= để đăng nhập xong quay
    // lại đúng chỗ thay vì luôn về mặc định /profile (xem safeNextTarget
    // trong app/(auth)/login/page.tsx).
    const loginUrl = new URL("/login", request.url);
    const target = pathname + request.nextUrl.search;
    if (target !== "/") loginUrl.searchParams.set("next", target);
    return NextResponse.redirect(loginUrl);
  }

  // KHÔNG tự đá /login → /dashboard chỉ vì cookie tồn tại: cookie có thể đã hết
  // hạn / bị thu hồi (vd sau khi đổi mật khẩu). Nếu đá về /dashboard rồi
  // dashboard-layout verify thất bại lại đá về /login → vòng lặp vô tận
  // (ERR_TOO_MANY_REDIRECTS). Cứ để /login hiển thị; đăng nhập lại là sạch.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
