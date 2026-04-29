'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RedirectToVerifyEmail() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const q = searchParams.toString()
    router.replace(q ? `/auth/verify-email?${q}` : '/auth/verify-email')
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
      <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" aria-hidden />
    </div>
  )
}

export default function VerifyLegacyRedirectPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-200" aria-hidden />
        </div>
      }
    >
      <RedirectToVerifyEmail />
    </Suspense>
  )
}
