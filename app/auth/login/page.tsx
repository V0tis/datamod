'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

/** /auth/login은 /login으로 통일 (기존 링크 호환용 리다이렉트) */
export default function AuthLoginPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const q = searchParams.toString()
    router.replace(q ? `/login?${q}` : '/login')
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">이동 중...</p>
    </div>
  )
}
