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

/** 잔여량에 따른 색상: Green(50% 이상) → Orange(20~50%) → Red(20% 미만) */
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

export function QuotaBar() {
  const { geminiQuota, fetchGeminiQuota } = useResearchStore()

  useEffect(() => {
    fetchGeminiQuota()
  }, [fetchGeminiQuota])

  const used = geminiQuota?.used ?? 0
  const limit = geminiQuota?.limit ?? GEMINI_DAILY_LIMIT
  const remainingPct = remainingPercent(used, limit)

  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-white px-4 py-2.5 shadow-sm">
      <div className="flex flex-1 items-center gap-3">
        <span className={cn('text-sm font-medium whitespace-nowrap', getQuotaColorClass(remainingPct))}>
          린의 분석 에너지: {Math.round(remainingPct)}%
        </span>
        <div className="min-w-[120px] max-w-[240px] flex-1">
          <Progress
            value={remainingPct}
            className={cn('h-2', getProgressIndicatorClass(remainingPct))}
          />
        </div>
      </div>
    </header>
  )
}
