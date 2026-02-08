'use client'

import { useEffect } from 'react'
import { Progress } from '@/components/ui/progress'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'

const GEMINI_DAILY_LIMIT = 1500

function remainingPercent(used: number, limit: number): number {
  if (limit <= 0) return 100
  return Math.max(0, Math.min(100, 100 - (used / limit) * 100))
}

function getQuotaColorClass(remainingPct: number): string {
  if (remainingPct >= 50) return 'text-emerald-600'
  if (remainingPct >= 20) return 'text-amber-600'
  return 'text-red-600'
}

function getProgressIndicatorClass(remainingPct: number): string {
  if (remainingPct >= 50) return '[&_[data-slot=progress-indicator]]:bg-emerald-500'
  if (remainingPct >= 20) return '[&_[data-slot=progress-indicator]]:bg-amber-500'
  return '[&_[data-slot=progress-indicator]]:bg-red-500'
}

/** 상단 에너지 바: 가로로 길고 얇게 배치해 디자인을 해치지 않음 */
export function QuotaBar() {
  const { geminiQuota, fetchGeminiQuota } = useResearchStore()

  useEffect(() => {
    fetchGeminiQuota()
  }, [fetchGeminiQuota])

  const used = geminiQuota?.used ?? 0
  const limit = geminiQuota?.limit ?? GEMINI_DAILY_LIMIT
  const remainingPct = remainingPercent(used, limit)

  return (
    <header className="sticky top-0 z-30 flex h-9 w-full items-center gap-3 border-b border-border bg-white/95 px-4 py-1.5 backdrop-blur-sm">
      <span
        className={cn(
          'text-xs font-medium whitespace-nowrap shrink-0',
          getQuotaColorClass(remainingPct)
        )}
      >
        에너지 {Math.round(remainingPct)}%
      </span>
      <div className="min-w-0 flex-1 max-w-full">
        <Progress
          value={remainingPct}
          className={cn('h-1.5', getProgressIndicatorClass(remainingPct))}
        />
      </div>
    </header>
  )
}
