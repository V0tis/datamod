'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'

const inputClass =
  'h-11 rounded-xl border-input bg-muted/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary/50'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
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

    const trimmedNickname = nickname.trim()
    if (!trimmedNickname) {
      setError('닉네임을 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password, nickname: trimmedNickname }),
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
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-1.5">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-3 rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            aria-label="홈으로 이동"
          >
            <RinLogo size={48} className="shrink-0" />
            <span className="text-4xl font-bold tracking-tight text-foreground">Rin-AI</span>
          </Link>
          <p className="text-muted-foreground text-sm">린과 함께 시작하세요</p>
        </div>

        <div className="rounded-3xl border border-border bg-card/95 p-8 shadow-xl backdrop-blur-sm">
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200"
              >
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

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
                className={inputClass}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nickname" className="text-foreground font-medium">
                닉네임
              </Label>
              <Input
                id="nickname"
                type="text"
                placeholder="사용할 닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={inputClass}
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
                className={inputClass}
                required
                minLength={8}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">최소 8자 이상 입력해주세요.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground font-medium">
                비밀번호 확인
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="비밀번호를 다시 입력하세요"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base shadow-md"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                '회원가입'
              )}
            </Button>

            <div className="text-center pt-1">
              <span className="text-muted-foreground text-base">이미 계정이 있으신가요? </span>
              <Link
                href="/login"
                className="text-base font-medium text-primary hover:text-primary/90 hover:underline focus:outline-none focus-visible:underline"
              >
                로그인
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
