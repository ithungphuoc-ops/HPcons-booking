'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  signInWithEmailAndPassword, signInWithPopup, sendPasswordResetEmail, signOut,
  GoogleAuthProvider, linkWithCredential, getMultiFactorResolver, TotpMultiFactorGenerator,
  type AuthCredential, type AuthError, type MultiFactorResolver, type MultiFactorError,
} from 'firebase/auth'
import { Eye, EyeOff } from 'lucide-react'
import { getFirebaseAuth, createGoogleProvider } from '@/lib/firebase/client'

const OAUTH_ERROR_MESSAGE: Record<string, string> = {
  not_provisioned: 'Tài khoản này chưa được cấp quyền truy cập HP Cons Portal. Liên hệ HR/IT để được tạo tài khoản.',
  oauth: 'Đăng nhập Google không thành công, vui lòng thử lại.',
}

/**
 * Đường quay lại sau đăng nhập (?next=). Chỉ chấp nhận đường dẫn nội bộ ("/...")
 * hoặc URL tuyệt đối trong hệ *.hpcore.vn (vd https://pkd.hpcore.vn/...) để chặn
 * chuyển hướng ra ngoài (open-redirect). Mặc định về /dashboard.
 */
function safeNextTarget(raw: string | null): string {
  if (!raw) return '/bookings'
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw
  try {
    const u = new URL(raw)
    if (u.protocol === 'https:' && (u.hostname === 'hpcore.vn' || u.hostname.endsWith('.hpcore.vn'))) {
      return u.toString()
    }
  } catch {
    /* URL không hợp lệ → về mặc định */
  }
  return '/bookings'
}

/** Điều hướng sau đăng nhập: nội bộ dùng router, khác domain dùng full-load */
function goAfterLogin(router: ReturnType<typeof useRouter>, target: string) {
  if (target.startsWith('/')) {
    router.push(target)
    router.refresh()
  } else {
    window.location.assign(target)
  }
}

/** Ghi log 1 lượt đăng nhập thất bại (sai mật khẩu, lỗi Google...) — bắn đi
 *  không chờ, không chặn UI dù ghi log lỗi. */
function reportFailedLogin(email: string, reason: string): void {
  fetch('/api/auth/login-failed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, reason }),
  }).catch(() => {})
}

async function createSession(idToken: string, method: 'password' | 'google'): Promise<string | null> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, method }),
  })
  if (res.ok) return null
  const body = await res.json().catch(() => ({}))
  return body.message ?? OAUTH_ERROR_MESSAGE[body.error] ?? body.error ?? 'Đăng nhập thất bại'
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  // Credential Google đang chờ liên kết — set khi Google báo email đã có tài
  // khoản mật khẩu (auth/account-exists-with-different-credential). Lần đăng
  // nhập mật khẩu kế tiếp sẽ tự liên kết credential này vào tài khoản.
  const [pendingGoogleCred, setPendingGoogleCred] = useState<AuthCredential | null>(null)
  // Chỉ set khi tài khoản có bật bảo mật hai lớp (TOTP) — Firebase chặn đăng
  // nhập giữa chừng, cần thêm bước nhập mã 6 số mới hoàn tất. Người CHƯA bật
  // 2FA không bao giờ thấy state này khác null.
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null)
  const [mfaMethod, setMfaMethod] = useState<'password' | 'google'>('password')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)

  /** true nếu đã xử lý như thử thách 2FA (gọi xong setMfaResolver) — caller
   *  không cần báo lỗi đăng nhập thất bại nữa. */
  function tryHandleMfaChallenge(e: unknown, method: 'password' | 'google'): boolean {
    const err = e as AuthError
    if (err.code !== 'auth/multi-factor-auth-required') return false
    const resolver = getMultiFactorResolver(getFirebaseAuth(), e as MultiFactorError)
    setMfaResolver(resolver)
    setMfaMethod(method)
    setError('')
    return true
  }

  async function handleMfaSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mfaResolver) return
    setMfaBusy(true)
    setError('')
    try {
      const hint = mfaResolver.hints[0]
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, mfaCode)
      const cred = await mfaResolver.resolveSignIn(assertion)
      const idToken = await cred.user.getIdToken()
      const err = await createSession(idToken, mfaMethod)
      if (err) {
        await signOut(getFirebaseAuth())
        setError(err)
        setMfaBusy(false)
        return
      }
      goAfterLogin(router, safeNextTarget(searchParams.get('next')))
    } catch {
      setError('Mã xác thực không đúng hoặc đã hết hạn, thử lại.')
      setMfaBusy(false)
    }
  }

  useEffect(() => {
    const code = searchParams.get('error')
    if (code) setError(OAUTH_ERROR_MESSAGE[code] ?? 'Có lỗi xảy ra, vui lòng thử lại.')
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setInfo('')

    const auth = getFirebaseAuth()
    try {
      const result = await signInWithEmailAndPassword(auth, email, password)
      if (pendingGoogleCred) {
        try {
          await linkWithCredential(result.user, pendingGoogleCred)
        } catch {
          /* liên kết lỗi (vd credential hết hạn) — không chặn đăng nhập, bỏ qua */
        }
        setPendingGoogleCred(null)
      }
      const idToken = await result.user.getIdToken()
      const err = await createSession(idToken, 'password')
      if (err) {
        await signOut(auth)
        setError(err)
        setLoading(false)
        return
      }
      goAfterLogin(router, safeNextTarget(searchParams.get('next')))
    } catch (e) {
      if (tryHandleMfaChallenge(e, 'password')) {
        setLoading(false)
        return
      }
      reportFailedLogin(email, (e as AuthError).code ?? 'unknown')
      setError('Email hoặc mật khẩu không đúng')
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    setError('')
    setInfo('')
    if (!email) {
      setError('Nhập email của bạn vào ô Email trước, rồi bấm "Quên mật khẩu?" lần nữa.')
      return
    }
    const auth = getFirebaseAuth()
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${window.location.origin}/reset-password`,
        handleCodeInApp: true,
      })
      setInfo(`Đã gửi link đặt lại mật khẩu tới ${email}. Kiểm tra hộp thư (kể cả mục Spam) nhé!`)
    } catch (e) {
      setError('Không gửi được email: ' + (e as Error).message)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setInfo('')
    const auth = getFirebaseAuth()
    try {
      const result = await signInWithPopup(auth, createGoogleProvider())
      const idToken = await result.user.getIdToken()
      const err = await createSession(idToken, 'google')
      if (err) {
        await signOut(auth)
        setError(err)
        return
      }
      goAfterLogin(router, safeNextTarget(searchParams.get('next')))
    } catch (e) {
      if (tryHandleMfaChallenge(e, 'google')) return

      const err = e as AuthError

      // Email này đã có tài khoản đăng nhập bằng mật khẩu — Firebase không tự
      // gộp 2 phương thức. Giữ credential Google lại, nhờ người dùng xác minh
      // bằng mật khẩu 1 lần để liên kết (xem handleLogin) — không tính là lỗi
      // thất bại nên KHÔNG ghi log.
      if (err.code === 'auth/account-exists-with-different-credential') {
        const cred = GoogleAuthProvider.credentialFromError(err)
        const conflictEmail = typeof err.customData?.email === 'string' ? err.customData.email : ''
        setPendingGoogleCred(cred)
        if (conflictEmail) setEmail(conflictEmail)
        setInfo(
          `Email ${conflictEmail || 'này'} đã có tài khoản đăng nhập bằng mật khẩu. ` +
          'Nhập mật khẩu rồi bấm "Đăng nhập" để liên kết — từ lần sau có thể dùng Google.'
        )
        return
      }

      // Người dùng tự đóng popup / huỷ — không phải lỗi thật, không ghi log.
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        reportFailedLogin(email, `Google: ${err.code ?? 'unknown'}`)
      }
      setError('Đăng nhập Google chưa khả dụng, vui lòng thử lại.')
    }
  }

  return (
    <div className="min-h-screen flex bg-white">
      {/* ===== Cột trái: Form đăng nhập ===== */}
      <div className="w-full lg:w-[440px] flex-shrink-0 flex flex-col justify-center px-8 sm:px-12 py-10">
        <div className="w-full max-w-sm mx-auto">
          {/* Logo */}
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="HP CONS"
              className="h-24 mx-auto mb-4 object-contain"
            />

            <h1 className="text-2xl font-bold text-gray-900">{mfaResolver ? 'Xác thực hai lớp' : 'Đăng nhập'}</h1>
            <p className="text-gray-500 text-sm mt-1.5">
              {mfaResolver
                ? 'Nhập mã 6 số từ ứng dụng xác thực (Google Authenticator, Microsoft Authenticator...).'
                : 'Chào mừng trở lại. Đăng nhập để bắt đầu làm việc.'}
            </p>
          </div>

          {mfaResolver ? (
            <form onSubmit={handleMfaSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mã xác thực</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  required
                  autoFocus
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm tracking-widest"
                />
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>}

              <button
                type="submit"
                disabled={mfaBusy || mfaCode.length < 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {mfaBusy ? 'Đang xác thực...' : 'Xác nhận'}
              </button>

              <button
                type="button"
                onClick={() => { setMfaResolver(null); setMfaCode(''); setError('') }}
                className="w-full text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                ← Quay lại đăng nhập
              </button>
            </form>
          ) : (
          <>
          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email của bạn"
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mật khẩu của bạn"
                  required
                  className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-600">Giữ tôi luôn đăng nhập</span>
            </label>

            {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>}
            {info && <p className="text-blue-600 text-sm bg-blue-50 px-4 py-2.5 rounded-lg">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">Hoặc, đăng nhập thông qua SSO</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Google SSO */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-colors text-sm"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.96 10.96 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Đăng nhập bằng Google
          </button>
          </>
          )}

          <p className="text-center text-xs text-gray-400 mt-8">
            © 2026 HP CONS · Công ty Cổ phần Đầu tư Hưng Phước
          </p>
        </div>
      </div>

      {/* ===== Cột phải: Cảnh công trường xây dựng (ẩn trên mobile) ===== */}
      <div className="hidden lg:flex relative flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-sky-100 via-blue-50 to-white">
        {/* Cảnh công trường vector */}
        <svg viewBox="0 0 900 620" className="w-full max-w-4xl px-8" fill="none">
          {/* Mặt trời */}
          <circle cx="790" cy="90" r="38" fill="#FDE68A" opacity="0.9" />

          {/* Mây */}
          <g fill="#fff" stroke="#CBD5E1" strokeWidth="2">
            <ellipse cx="150" cy="80" rx="55" ry="20" />
            <ellipse cx="195" cy="68" rx="40" ry="16" />
            <ellipse cx="560" cy="60" rx="48" ry="17" />
            <ellipse cx="600" cy="48" rx="34" ry="13" />
          </g>

          {/* Cần cẩu tháp */}
          <g stroke="#58595B" strokeWidth="5" strokeLinecap="round">
            <line x1="180" y1="540" x2="180" y2="150" />
            <line x1="205" y1="540" x2="205" y2="150" />
            {/* giằng chéo thân */}
            <line x1="180" y1="500" x2="205" y2="460" strokeWidth="2.5" />
            <line x1="205" y1="500" x2="180" y2="460" strokeWidth="2.5" />
            <line x1="180" y1="420" x2="205" y2="380" strokeWidth="2.5" />
            <line x1="205" y1="420" x2="180" y2="380" strokeWidth="2.5" />
            <line x1="180" y1="340" x2="205" y2="300" strokeWidth="2.5" />
            <line x1="205" y1="340" x2="180" y2="300" strokeWidth="2.5" />
            <line x1="180" y1="260" x2="205" y2="220" strokeWidth="2.5" />
            <line x1="205" y1="260" x2="180" y2="220" strokeWidth="2.5" />
            {/* tay cần */}
            <line x1="90" y1="150" x2="520" y2="150" />
            <line x1="192" y1="105" x2="192" y2="150" />
            <line x1="192" y1="105" x2="90" y2="150" strokeWidth="3" />
            <line x1="192" y1="105" x2="330" y2="150" strokeWidth="3" />
            <line x1="192" y1="105" x2="470" y2="150" strokeWidth="2.5" />
            {/* đối trọng */}
            <rect x="95" y="150" width="45" height="30" fill="#58595B" />
            {/* dây cáp + móc */}
            <line x1="430" y1="150" x2="430" y2="255" strokeWidth="3" />
            <path d="M430 255 q0 14 -12 14 q-10 0 -10 -10" strokeWidth="4" fill="none" />
          </g>

          {/* Khối vật liệu treo trên móc */}
          <rect x="398" y="272" width="64" height="26" rx="3" fill="#6CBE45" opacity="0.9" />

          {/* Tòa nhà 1 — đang xây (khung dầm) */}
          <g>
            <rect x="290" y="310" width="190" height="230" fill="#fff" stroke="#58595B" strokeWidth="4" />
            {/* sàn */}
            <line x1="290" y1="368" x2="480" y2="368" stroke="#58595B" strokeWidth="3" />
            <line x1="290" y1="426" x2="480" y2="426" stroke="#58595B" strokeWidth="3" />
            <line x1="290" y1="484" x2="480" y2="484" stroke="#58595B" strokeWidth="3" />
            {/* cột */}
            <line x1="353" y1="310" x2="353" y2="540" stroke="#58595B" strokeWidth="3" />
            <line x1="417" y1="310" x2="417" y2="540" stroke="#58595B" strokeWidth="3" />
            {/* tường gạch xây dở tầng dưới */}
            <rect x="293" y="487" width="120" height="50" fill="#1B75BB" opacity="0.15" />
            <rect x="356" y="429" width="61" height="54" fill="#1B75BB" opacity="0.1" />
          </g>

          {/* Tòa nhà 2 — hoàn thiện (màu thương hiệu) */}
          <g>
            <rect x="530" y="250" width="150" height="290" fill="#1B75BB" />
            <rect x="530" y="250" width="150" height="290" fill="url(#winGrid)" />
            {/* cửa sổ */}
            {Array.from({ length: 6 }).map((_, r) =>
              Array.from({ length: 3 }).map((_, c) => (
                <rect key={`${r}-${c}`} x={545 + c * 45} y={268 + r * 45} width="26" height="26" rx="3" fill="#DBEAFE" opacity="0.9" />
              ))
            )}
            {/* mái xanh lá */}
            <polygon points="530,250 605,215 680,250" fill="#6CBE45" />
          </g>

          {/* Tòa nhà 3 — thấp bên phải */}
          <g>
            <rect x="700" y="380" width="130" height="160" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="3" />
            {Array.from({ length: 3 }).map((_, r) =>
              Array.from({ length: 3 }).map((_, c) => (
                <rect key={`b3-${r}-${c}`} x={712 + c * 38} y={396 + r * 42} width="22" height="24" rx="2" fill="#94A3B8" opacity="0.6" />
              ))
            )}
          </g>

          {/* Hàng rào công trường sọc chéo */}
          <g>
            <rect x="60" y="540" width="780" height="26" fill="#fff" stroke="#58595B" strokeWidth="2.5" />
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={i} x1={75 + i * 60} y1="566" x2={100 + i * 60} y2="540" stroke="#6CBE45" strokeWidth="8" />
            ))}
          </g>

          {/* Nền đất */}
          <line x1="30" y1="566" x2="870" y2="566" stroke="#58595B" strokeWidth="4" strokeLinecap="round" />

          {/* Cây xanh */}
          <g>
            <circle cx="70" cy="510" r="26" fill="#6CBE45" opacity="0.85" />
            <circle cx="92" cy="522" r="18" fill="#6CBE45" opacity="0.7" />
            <rect x="66" y="530" width="8" height="36" fill="#58595B" />
            <circle cx="856" cy="520" r="22" fill="#6CBE45" opacity="0.8" />
            <rect x="852" y="534" width="7" height="32" fill="#58595B" />
          </g>
        </svg>

        {/* Chữ giới thiệu */}
        <div className="text-center mt-2 px-12 pb-8">
          <h2 className="text-gray-800 text-2xl font-bold">HP CONS Portal</h2>
          <p className="text-gray-500 text-sm mt-2">Một tài khoản duy nhất cho mọi ứng dụng nội bộ</p>
        </div>
      </div>
    </div>
  )
}
