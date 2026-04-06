'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/auth-page-shell'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.')
      return
    }

    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('유효한 이메일을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        const errorMessage = data?.error ?? '회원가입에 실패했습니다.'
        setError(errorMessage)
        return
      }

      window.location.href = `/auth/verify?email=${encodeURIComponent(trimmedEmail)}`
    } catch {
      setError('요청 처리에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      subtitle="AI 기반 시장 리서치 도구"
      tagline="가입 후 이메일 인증을 완료하면 바로 분석을 시작할 수 있습니다"
    >
      <div className="p-6 sm:p-8">
        <form onSubmit={handleSignup} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
              <span>{error}</span>
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
              minLength={8}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">최소 8자 이상</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              비밀번호 확인
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="비밀번호를 다시 입력하세요"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="h-11"
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" aria-label="처리 중" /> : '회원가입'}
          </Button>

          <p className="text-center text-sm text-muted-foreground pt-1">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              로그인
            </Link>
          </p>
        </form>
      </div>
    </AuthPageShell>
  )
}
