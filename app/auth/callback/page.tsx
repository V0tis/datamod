'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { showErrorToast } from '@/lib/error-toast'
import { RinLogo } from '@/components/rin-logo'
import { CheckCircle2 } from 'lucide-react'

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  if (!hash || !hash.startsWith('#')) return params
  const query = hash.slice(1)
  for (const part of query.split('&')) {
    const [key, value] = part.split('=')
    if (key && value) params[key] = decodeURIComponent(value)
  }
  return params
}

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    const params = parseHashParams(hash)
    const accessToken = params.access_token
    const refreshToken = params.refresh_token

    if (!accessToken) {
      setStatus('error')
      setErrorMessage('유효한 인증 링크가 아닙니다. 이메일의 링크를 다시 확인해주세요.')
      return
    }

    const supabase = createClient()
    supabase.auth
      .setSession({
        access_token: accessToken,
        refresh_token: refreshToken ?? '',
      })
      .then(async () => {
        await fetch('/api/auth/sync-profile', { method: 'POST' })
        setStatus('success')
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage('로그인 처리 중 오류가 발생했습니다.')
        showErrorToast(err, { fallbackMessage: '로그인 처리 중 오류가 발생했습니다.' })
      })
  }, [])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <LoadingState
          message="로그인 처리 중이에요"
          detail="잠시만 기다려 주세요."
          size="lg"
        />
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <ErrorState
            title="인증에 실패했습니다"
            description={errorMessage}
            recoveryLabel="로그인 페이지로"
            onRecovery={() => { window.location.href = '/auth/login' }}
            secondaryAction={
              <Button variant="outline" size="sm" asChild>
                <Link href="/">홈으로</Link>
              </Button>
            }
          />
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">
              이메일 인증이 완료되었습니다.
            </h1>
            <p className="text-sm text-muted-foreground">
              rin-ai 서비스를 이용하실 수 있어요.
            </p>
          </div>
        </div>
        <Button
          asChild
          className="w-full h-12 rounded-lg gap-2 text-base font-medium"
        >
          <Link href="/">
            <RinLogo size={20} />
            rin-ai 시작하기
          </Link>
        </Button>
      </div>
    </main>
  )
}
