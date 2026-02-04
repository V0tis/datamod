'use client'

import React, { useState, useRef, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, CheckCircle2, Mail, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function VerifyContent() {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') || ''
  const [email, setEmail] = useState(emailParam)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState('')
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (emailParam) setEmail(emailParam)
  }, [emailParam])

  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
    if (index === 5 && value) handleVerify(newOtp.join(''))
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').slice(0, 6)
    if (!/^\d+$/.test(pastedData)) return
    const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6)
    setOtp(newOtp)
    const nextIndex = Math.min(pastedData.length, 5)
    inputRefs.current[nextIndex]?.focus()
    if (pastedData.length === 6) handleVerify(pastedData)
  }

  const handleVerify = async (code: string) => {
    const targetEmail = email.trim().toLowerCase()
    if (!targetEmail) {
      setError('이메일을 입력해주세요.')
      return
    }
    setError('')
    setIsVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, code }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '인증에 실패했습니다.')
        return
      }
      const signInRes = await signIn('otp', {
        email: data.email,
        token: data.token,
        callbackUrl: '/',
        redirect: false,
      })
      if (signInRes?.error) {
        setError('로그인 처리에 실패했습니다.')
        return
      }
      setIsVerified(true)
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    } catch {
      setError('요청 처리에 실패했습니다.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendCode = async () => {
    const targetEmail = email.trim().toLowerCase()
    if (!targetEmail) return
    setError('')
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data?.error ?? '재전송에 실패했습니다.')
        return
      }
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    } catch {
      setError('재전송에 실패했습니다.')
    }
  }

  if (isVerified) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center animate-scale-in">
                  <CheckCircle2 className="w-12 h-12 text-primary" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">인증 완료!</h1>
              <p className="text-muted-foreground">이메일 인증이 완료되었습니다. 홈으로 이동합니다.</p>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>이동 중...</span>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      <div className="p-6">
        <Link href="/auth/login">
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
              <h1 className="text-4xl font-bold tracking-tight text-foreground">Rin-AI</h1>
            </div>
          </div>

          <div className="bg-card rounded-3xl shadow-lg border border-border p-8 space-y-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-foreground">이메일 인증</h2>
                <p className="text-sm text-muted-foreground">
                  {email ? `${email}로 전송된` : '이메일로 전송된'} 6자리 인증 코드를 입력하세요
                </p>
              </div>
            </div>

            {!emailParam && (
              <div className="space-y-2">
                <label className="text-sm font-medium">이메일</label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-xl"
                  disabled={isVerifying}
                />
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-4">
              <div className="flex gap-2 justify-center">
                {otp.map((digit, index) => (
                  <Input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={index === 0 ? handlePaste : undefined}
                    className="w-12 h-14 text-center text-xl font-bold rounded-xl"
                    disabled={isVerifying}
                  />
                ))}
              </div>

              <Button
                onClick={() => handleVerify(otp.join(''))}
                disabled={otp.some((d) => !d) || isVerifying}
                className="w-full h-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-base shadow-md disabled:opacity-50"
              >
                {isVerifying ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    인증 중...
                  </span>
                ) : (
                  '인증하기'
                )}
              </Button>
            </div>

            <div className="text-center text-sm">
              <span className="text-muted-foreground">코드를 받지 못하셨나요? </span>
              <button
                type="button"
                onClick={handleResendCode}
                className="text-primary hover:underline font-medium"
                disabled={isVerifying}
              >
                재전송
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-background">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  )
}
