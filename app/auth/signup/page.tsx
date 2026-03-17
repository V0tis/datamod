'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'

const inputClass =
  'h-12 rounded-xl border-[#e0e0e0] bg-[#fafafa] text-[#1A1A1A] placeholder:text-[#9e9e9e] focus-visible:ring-2 focus-visible:ring-[#FFB800] focus-visible:border-[#FFB800]'

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
          <form onSubmit={handleSignup} className="space-y-5">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-[#FFAB91] bg-[#FFEBEE] px-3 py-2.5 text-sm text-[#C62828]"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
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
                className={inputClass}
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
                className={inputClass}
                required
                minLength={8}
                disabled={loading}
              />
              <p className="text-xs text-[#6b7280]">최소 8자 이상 입력해주세요.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[#1A1A1A] font-semibold text-sm">
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
              className="w-full h-12 rounded-xl bg-[#FFB800] hover:bg-[#E6A600] text-[#1A1A1A] font-bold shadow-[0_2px_4px_rgba(255,184,0,0.3)]"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                '회원가입'
              )}
            </Button>

            <div className="text-center pt-2 text-sm text-[#6b7280]">
              이미 계정이 있으신가요? <Link href="/login" className="text-[#FFB800] font-semibold hover:underline">로그인</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
