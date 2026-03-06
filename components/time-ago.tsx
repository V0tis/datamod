'use client'

import { useState, useEffect } from 'react'
import { formatTimeAgo } from '@/lib/utils'

/**
 * 서버/클라이언트 동일 출력으로 하이드레이션 불일치를 피하고,
 * 마운트 후에만 상대 시간(방금 전, N분 전)을 표시합니다.
 */
export function TimeAgo({ isoString, className }: { isoString: string | null | undefined; className?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!isoString) {
    return <span className={className}>—</span>
  }

  if (!mounted) {
    const d = new Date(isoString)
    const fallback = `${d.getUTCFullYear()}. ${String(d.getUTCMonth() + 1).padStart(2, '0')}. ${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    return <span className={className} suppressHydrationWarning>{fallback}</span>
  }

  return <span className={className}>{formatTimeAgo(isoString)}</span>
}
