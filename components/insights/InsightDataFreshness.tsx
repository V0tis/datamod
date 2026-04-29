'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'

type InsightDataFreshnessProps = {
  /** ISO 8601 — 분석·수집 기준 시각 */
  iso: string | null | undefined
  className?: string
}

/**
 * 인사이트 데이터의 정보 신선도 — date-fns formatDistanceToNow (ko), 1분마다 갱신.
 */
export function InsightDataFreshness({ iso, className }: InsightDataFreshnessProps) {
  const [mounted, setMounted] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !iso) return
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [mounted, iso])

  const label = useMemo(() => {
    if (!iso) return null
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return formatDistanceToNow(d, { addSuffix: true, locale: ko })
  }, [iso, now])

  if (!iso || !label) {
    return null
  }

  if (!mounted) {
    const d = new Date(iso)
    const fallback =
      Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    return (
      <span className={cn('text-xs text-gray-400 ', className)} suppressHydrationWarning>
        [{fallback} 기준]
      </span>
    )
  }

  return (
    <span
      className={cn('text-xs text-gray-400  tabular-nums', className)}
      title={new Date(iso).toLocaleString('ko-KR')}
    >
      [{label} 데이터]
    </span>
  )
}
