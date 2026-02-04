'use client'

import React, { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const hash = window.location.hash
    const params = parseHashParams(hash)
    const accessToken = params.access_token

    if (!accessToken) {
      setStatus('error')
      setErrorMessage('유효한 인증 링크가 아닙니다. 이메일의 링크를 다시 확인해주세요.')
      return
    }

    signIn('magic-link', {
      access_token: accessToken,
      callbackUrl: '/',
      redirect: false,
    })
      .then((res) => {
        if (res?.error) {
          setStatus('error')
          setErrorMessage(res.error === 'CredentialsSignin' ? '인증에 실패했습니다.' : res.error)
          return
        }
        if (res?.url) {
          setStatus('success')
          window.location.href = res.url
          return
        }
        setStatus('success')
        router.replace('/')
      })
      .catch(() => {
        setStatus('error')
        setErrorMessage('로그인 처리 중 오류가 발생했습니다.')
      })
  }, [router])

  if (status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">로그인 중입니다. 잠시만 기다려주세요.</p>
        </div>
      </main>
    )
  }

  if (status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">인증 실패</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <Button className="rounded-full" size="lg" asChild>
            <Link href="/auth/login">로그인 페이지로</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">대시보드로 이동 중...</p>
      </div>
    </main>
  )
}
