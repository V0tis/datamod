'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { History, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HistoryItem {
  id: string
  keyword: string
  country_code: string
  updated_at: string | null
}

function formatTimestamp(isoString: string | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return '방금'
  if (diffMins < 60) return `${diffMins}분 전`
  if (diffHours < 24) return `${diffHours}시간 전`
  if (diffDays < 7) return `${diffDays}일 전`
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

export interface AnalysisHistorySidebarProps {
  currentKeyword: string | null
  currentCountry: string
  /** When this changes, refetch list (e.g. displayResult.updated_at after new analysis) */
  refetchTrigger?: string | null
  className?: string
}

export function AnalysisHistorySidebar({
  currentKeyword,
  currentCountry,
  refetchTrigger,
  className,
}: AnalysisHistorySidebarProps) {
  const router = useRouter()
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/research/history?limit=20&offset=0')
      const data = await res.json()
      if (!res.ok) return
      const list = (data.list ?? []) as HistoryItem[]
      setItems(list)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  useEffect(() => {
    if (refetchTrigger) fetchHistory()
  }, [refetchTrigger, fetchHistory])

  const handleSelect = (item: HistoryItem) => {
    const kw = (item.keyword ?? '').trim()
    const country = (item.country_code ?? 'KR').trim() || 'KR'
    if (!kw) return
    router.replace(`/results?keyword=${encodeURIComponent(kw)}&country=${encodeURIComponent(country)}`)
  }

  const isActive = (item: HistoryItem) =>
    (item.keyword ?? '').trim() === (currentKeyword ?? '').trim() &&
    ((item.country_code ?? 'KR').trim() || 'KR') === (currentCountry ?? 'KR')

  return (
    <div className={cn('rounded-xl border border-border/60 bg-card/50 p-4', className)}>
      <h3 className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-2">
        <History className="h-3.5 w-3.5" />
        최근 분석
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">분석 기록이 없습니다.</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2.5 transition-colors',
                  'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive(item)
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'text-foreground'
                )}
              >
                <p className="text-sm font-medium truncate" title={item.keyword}>
                  {item.keyword || '제목 없음'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {formatTimestamp(item.updated_at)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
