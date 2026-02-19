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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) {
        const msg = signInError.message ?? ''
        setError(
          msg.includes('Invalid') || msg.includes('invalid') || msg.includes('credentials')
            ? '이메일 또는 비밀번호가 올바르지 않습니다.'
            : msg.includes('이메일') ? msg : '이메일 또는 비밀번호가 올바르지 않습니다.'
        )
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2"
            aria-label="홈으로 이동"
          >
            <RinLogo size={32} className="shrink-0" />
            <span className="text-xl font-semibold text-foreground">Rin</span>
          </Link>
          <p className="text-sm text-muted-foreground">PM 의사결정을 위한 시장 분석 도구</p>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/50 p-6">
          <form onSubmit={handleLogin} className="space-y-5">
            {showLoginRequired && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
              >
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>로그인이 필요한 서비스입니다.</span>
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground font-medium">
                이메일
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-input bg-muted/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground font-medium">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl border-input bg-muted/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '로그인'}
            </Button>

            <div className="text-center pt-2 text-sm text-muted-foreground">
              계정이 없으신가요? <Link href="/auth/signup" className="text-primary hover:underline">회원가입</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">로딩 중...</div>}>
      <LoginForm />
    </Suspense>
  )
}
