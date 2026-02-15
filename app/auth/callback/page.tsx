'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorState } from '@/components/ui/error-state'
import { showErrorToast } from '@/lib/error-toast'

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
        window.location.href = '/'
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
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <LoadingState
        message="대시보드로 이동 중이에요"
        detail="잠시만 기다려 주세요."
        size="lg"
      />
    </main>
  )
}
