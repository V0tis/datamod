'use client'

import React, { Suspense, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

const STEPS = [
  '이메일함을 열어주세요',
  '발송된 인증 링크를 클릭해주세요',
  '자동으로 로그인됩니다',
]

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const emailFromQuery = searchParams.get('email')?.trim() ?? ''

  const [userEmail, setUserEmail] = useState(emailFromQuery)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending'>('idle')

  useEffect(() => {
    setUserEmail(emailFromQuery)
  }, [emailFromQuery])

  useEffect(() => {
    if (emailFromQuery) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setUserEmail(user.email)
    })
  }, [emailFromQuery])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = window.setTimeout(() => {
      setResendCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => window.clearTimeout(id)
  }, [resendCooldown])

  const handleResend = async () => {
    const email = userEmail.trim()
    if (!email) {
      toast.error('이메일 주소를 확인할 수 없습니다. 로그인 후 다시 시도해 주세요.')
      return
    }
    if (resendCooldown > 0 || resendStatus === 'sending') return

    setResendStatus('sending')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      })
      if (error) {
        toast.error(error.message ?? '재발송에 실패했습니다.')
        setResendStatus('idle')
        return
      }
      setResendCooldown(60)
      toast.success('인증 메일을 다시 보냈습니다.')
      setResendStatus('idle')
    } catch {
      toast.error('재발송 요청에 실패했습니다.')
      setResendStatus('idle')
    }
  }

  const displayEmail = userEmail || '가입하신 이메일'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F7F8FA] p-4">
      <div className="mb-8 flex items-center gap-2">
        <Image
          src="/assets/logo_rin_ai.svg"
          alt="Datamod"
          width={120}
          height={28}
          className="h-7 w-auto"
          priority
        />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50">
          <Mail className="h-8 w-8 text-blue-600" aria-hidden />
        </div>

        <h1 className="mb-2 text-xl font-bold text-gray-900">이메일을 확인해주세요</h1>

        <p className="mb-2 text-sm leading-relaxed text-gray-500">
          가입하신 이메일 주소로 인증 링크를 발송했습니다.
        </p>
        <p className="mb-6 text-sm font-medium text-blue-600 break-all">{displayEmail}</p>

        <div className="mb-6 space-y-2 rounded-xl bg-gray-50 p-4 text-left">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                {i + 1}
              </div>
              <span className="text-sm text-gray-600">{step}</span>
            </div>
          ))}
        </div>

        <Button variant="primary" className="mb-3 h-12 w-full rounded-xl text-sm font-semibold" asChild>
          <Link href="/auth/login">로그인 페이지로 이동</Link>
        </Button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || resendStatus === 'sending'}
          className={cn(
            'text-sm text-gray-400 transition-colors hover:text-gray-600',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          {resendStatus === 'sending'
            ? '재발송 중…'
            : resendCooldown > 0
              ? `이메일 재발송 (${resendCooldown}초 후 가능)`
              : '이메일을 받지 못하셨나요? 재발송'}
        </button>

        <p className="mt-3 text-xs text-gray-400">스팸함도 확인해보세요</p>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" aria-hidden />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
