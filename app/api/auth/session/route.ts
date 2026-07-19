import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { SESSION_MAX_AGE_MS } from "@/lib/session";
import { logLogin, getClientIp } from "@/lib/loginHistory";
import { appendSessionCookies, appendClearSessionCookies } from "@/lib/session-cookie";

export async function POST(request: Request) {
  const { idToken, method } = await request.json();
  if (typeof idToken !== "string" || !idToken) {
    return NextResponse.json({ error: "Thiếu idToken" }, { status: 400 });
  }
  const loginMethod = method === "google" ? "google" : "password";

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ" }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");

  // Chốt "closed directory": chỉ tài khoản đã có users/{uid} mới được cấp session.
  const profileSnap = await adminDb.collection("users").doc(decoded.uid).get();
  if (!profileSnap.exists) {
    await logLogin({
      uid: decoded.uid,
      email: decoded.email ?? "",
      fullName: null,
      status: "rejected",
      ip,
      userAgent,
      method: loginMethod,
    });
    return NextResponse.json(
      { error: "not_provisioned", message: "Tài khoản này chưa được cấp quyền truy cập HP Cons Portal. Liên hệ HR/IT để được tạo tài khoản." },
      { status: 403 },
    );
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: SESSION_MAX_AGE_MS });

  await logLogin({
    uid: decoded.uid,
    email: decoded.email ?? "",
    fullName: (profileSnap.data()?.fullName as string | undefined) ?? null,
    status: "success",
    ip,
    userAgent,
    method: loginMethod,
  });

  const res = NextResponse.json({ ok: true });
  appendSessionCookies(res, sessionCookie);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  appendClearSessionCookies(res);
  return res;
}
