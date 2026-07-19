'use client'

import { useState, Suspense } from 'react'
import { confirmPasswordReset } from 'firebase/auth'
import { Eye, EyeOff } from 'lucide-react'
import { getFirebaseAuth } from '@/lib/firebase/client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const oobCode = searchParams.get('oobCode')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!oobCode) {
      setError('Đường dẫn đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Yêu cầu gửi lại email từ trang đăng nhập.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (password !== confirm) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    setLoading(true)
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password)
      setDone(true)
    } catch (e) {
      setError('Đặt mật khẩu thất bại: ' + (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-blue-50 to-white p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
        <div className="text-center mb-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="HP CONS" className="h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-bold text-gray-900">Đặt mật khẩu mới</h1>
          <p className="text-gray-500 text-sm mt-1.5">Nhập mật khẩu mới cho tài khoản của bạn</p>
        </div>

        {done ? (
          <div className="text-center space-y-4">
            <p className="text-green-600 text-sm bg-green-50 px-4 py-2.5 rounded-lg">Đặt mật khẩu thành công! Đăng nhập lại với mật khẩu mới.</p>
            <button
              onClick={() => router.push('/login')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              Về trang đăng nhập
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  required
                  className="w-full px-4 py-2.5 pr-11 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nhập lại mật khẩu mới</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 px-4 py-2.5 rounded-lg">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {loading ? 'Đang lưu...' : 'Xác nhận mật khẩu mới'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full text-gray-500 hover:text-gray-700 hover:bg-gray-50 font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              Bỏ qua, về trang đăng nhập →
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
