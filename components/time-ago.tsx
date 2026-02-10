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
    const fallback = new Date(isoString).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    return <span className={className}>{fallback}</span>
  }

  return <span className={className}>{formatTimeAgo(isoString)}</span>
}
