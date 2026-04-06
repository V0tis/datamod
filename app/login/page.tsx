'use client'

import React, { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Info } from 'lucide-react'
import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/auth-page-shell'

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
    <AuthPageShell
      subtitle="AI 기반 시장 리서치 도구"
      tagline="빠르게 분석하고, 바로 실행하세요"
    >
      <div className="p-6 sm:p-8">
        <form onSubmit={handleLogin} className="space-y-5">
          {showLoginRequired && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-foreground"
            >
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" aria-hidden />
              <span>로그인이 필요한 서비스입니다.</span>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              이메일
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              비밀번호
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11"
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" aria-label="로그인 중" /> : '로그인'}
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-1">
            계정이 없으신가요?{' '}
            <Link href="/auth/signup" className="font-medium text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </form>
      </div>
    </AuthPageShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
          로딩 중…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
