'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

const EXCLUDED_PATHS = ['/login', '/auth/signup', '/auth/verify', '/auth/verify-email', '/settings']
const SESSION_STORAGE_KEY = 'rin_api_key_toast_shown'

function isExcludedPath(path: string | null): boolean {
  if (!path) return true
  const normalized = path.split('?')[0]
  return EXCLUDED_PATHS.some((p) => normalized === p || normalized.startsWith(p + '/'))
}

export function ApiKeyValidationProvider() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined' || isExcludedPath(pathname)) return

    const showToast = () => {
      if (sessionStorage.getItem(SESSION_STORAGE_KEY)) return
      sessionStorage.setItem(SESSION_STORAGE_KEY, '1')
      toast.warning('AI 분석을 사용하려면 API 키 설정이 필요합니다.', {
        action: {
          label: '설정 페이지로 이동',
          onClick: () => router.push('/settings/license'),
        },
        duration: 10000,
      })
    }

    const check = async () => {
      try {
        const res = await fetch('/api/settings/keys-status')
        if (res.status === 401) return
        if (!res.ok) return
        const json = await res.json()
        if (json?.hasRequiredKeys === true) return
        showToast()
      } catch {
        // ignore network errors
      }
    }

    check()
  }, [pathname, router])

  return null
}
