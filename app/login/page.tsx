'use client'

import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Info } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'

const loginRequiredReason = 'login_required'

function LoginForm() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const showLoginRequired = searchParams.get('reason') === loginRequiredReason
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !password) {
      setError('이메일과 비밀번호를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) {
        const msg = (signInError.message ?? '').toLowerCase()
        const code = (signInError as { code?: string }).code ?? ''
        if (
          code === 'email_not_confirmed' ||
          msg.includes('email not confirmed') ||
          msg.includes('이메일 인증') ||
          msg.includes('이메일 확인')
        ) {
          setError('이메일 인증이 완료되지 않아 로그인할 수 없습니다. 가입 시 발송된 인증 메일의 링크를 클릭해 주세요.')
          return
        }
        setError(
          msg.includes('invalid') || msg.includes('credentials')
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : signInError.message?.includes('이메일') ? signInError.message : '이메일 또는 비밀번호가 올바르지 않습니다.'
        )
        return
      }

      if (data?.user && !data.user.email_confirmed_at) {
        await supabase.auth.signOut()
        setError('이메일 인증이 완료되지 않아 로그인할 수 없습니다. 가입 시 발송된 인증 메일의 링크를 클릭해 주세요.')
        return
      }

      window.location.href = callbackUrl
    } catch {
      setError('로그인 처리에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-[#f5f5f5]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2"
            aria-label="홈으로 이동"
          >
            <RinLogo size={32} className="shrink-0" />
            <span className="text-xl font-bold text-[#1A1A1A]">Rin</span>
          </Link>
          <p className="text-sm text-[#6b7280]">PM 의사결정을 위한 시장 분석 도구</p>
        </div>

        <div className="rounded-2xl border border-[#e8e8e8] bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <form onSubmit={handleLogin} className="space-y-5">
            {showLoginRequired && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FFE082] bg-[#FFFDE7] px-3 py-2.5 text-sm text-[#5D4037]"
              >
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#FFB800]" />
                <span>로그인이 필요한 서비스입니다.</span>
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-[#FFAB91] bg-[#FFEBEE] px-3 py-2.5 text-sm text-[#C62828]"
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#1A1A1A] font-semibold text-sm">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl border-[#e0e0e0] bg-[#fafafa] text-[#1A1A1A] placeholder:text-[#9e9e9e] focus-visible:ring-2 focus-visible:ring-[#FFB800] focus-visible:border-[#FFB800]"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#1A1A1A] font-semibold text-sm">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl border-[#e0e0e0] bg-[#fafafa] text-[#1A1A1A] placeholder:text-[#9e9e9e] focus-visible:ring-2 focus-visible:ring-[#FFB800] focus-visible:border-[#FFB800]"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[#FFB800] hover:bg-[#E6A600] text-[#1A1A1A] font-bold shadow-[0_2px_4px_rgba(255,184,0,0.3)]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '로그인'}
            </Button>

            <div className="text-center pt-2 text-sm text-[#6b7280]">
              계정이 없으신가요? <Link href="/auth/signup" className="text-[#FFB800] font-semibold hover:underline">회원가입</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-[#6b7280]">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  )
}
