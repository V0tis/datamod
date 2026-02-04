'use client'

import React, { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<'magic' | 'otp' | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setMessage('')
    setLoading('magic')
    try {
      const res = await signIn('email', {
        email: email.trim().toLowerCase(),
        callbackUrl: '/',
        redirect: false,
      })
      if (res?.error) {
        setError(res.error === 'EmailSignin' ? '이메일 발송에 실패했습니다.' : res.error)
        return
      }
      setMessage('로그인 링크가 이메일로 발송되었습니다. 메일을 확인해주세요.')
    } catch {
      setError('요청 처리에 실패했습니다.')
    } finally {
      setLoading(null)
    }
  }

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setMessage('')
    setLoading('otp')
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '인증 코드 발송에 실패했습니다.')
        return
      }
      window.location.href = `/auth/verify?email=${encodeURIComponent(email.trim().toLowerCase())}`
      return
    } catch {
      setError('요청 처리에 실패했습니다.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <div className="p-6">
        <Link href="/">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl">🐕</span>
              <h1 className="text-4xl font-bold tracking-tight text-foreground">
                Rin-AI
              </h1>
            </div>
            <p className="text-muted-foreground text-sm">
              로그인하고 최신 정보를 받아보세요
            </p>
          </div>

          <div className="bg-card rounded-3xl shadow-lg border border-border p-8 space-y-6">
            <form onSubmit={handleMagicLink} className="space-y-5">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {message && (
                <p className="text-sm text-primary">{message}</p>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  required
                  disabled={!!loading}
                />
              </div>

              <Button
                type="submit"
                disabled={!!loading}
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base shadow-md"
              >
                {loading === 'magic' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Magic Link로 로그인'
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">또는</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full h-12 rounded-full"
              disabled={!!loading}
              onClick={handleSendOtp}
            >
              {loading === 'otp' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                '인증 코드로 로그인'
              )}
            </Button>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">계정이 없으신가요? </span>
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                회원가입
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
