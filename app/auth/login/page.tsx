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
      const res = await signIn('credentials', {
        email: trimmedEmail,
        password,
        callbackUrl: '/',
        redirect: false,
      })

      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : res.error)
        if (res.error.includes('인증')) setError(res.error)
        return
      }

      if (res?.url) {
        window.location.href = res.url
        return
      }
      window.location.href = '/'
    } catch {
      setError('로그인 처리에 실패했습니다.')
    } finally {
      setLoading(false)
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
            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <p className="text-sm text-destructive">{error}</p>
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
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-xl"
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
                  '로그인'
                )}
              </Button>
            </form>

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
