'use client'

import { cn } from '@/lib/utils'

/** Factor breakdown for explainability: no algorithm change, presentation only. */
export interface SentimentFactors {
  positive?: number
  neutral?: number
  negative?: number
}

function normalizeFactors(factors: SentimentFactors | null | undefined): { positive: number; neutral: number; negative: number } | null {
  if (!factors || typeof factors !== 'object') return null
  const p = Number(factors.positive)
  const n = Number(factors.neutral)
  const neg = Number(factors.negative)
  if (!Number.isFinite(p) || !Number.isFinite(n) || !Number.isFinite(neg)) return null
  const total = p + n + neg
  if (total <= 0) return null
  return {
    positive: Math.round((p / total) * 100),
    neutral: Math.round((n / total) * 100),
    negative: Math.round((neg / total) * 100),
  }
}

/**
 * Shows contributing factors for a sentiment score so PMs can see why the score is what it is.
 * Uses theme tokens only; minimal bar-style indicators.
 */
export function SentimentFactorBreakdown({
  factors,
  className,
}: {
  factors: SentimentFactors | null | undefined
  className?: string
}) {
  const norm = normalizeFactors(factors)
  if (!norm) return null

  const rows = [
    { label: '긍정 신호', value: norm.positive, barClass: 'bg-emerald-500/80 dark:bg-emerald-400/70' },
    { label: '중립', value: norm.neutral, barClass: 'bg-muted-foreground/50' },
    { label: '부정·리스크', value: norm.negative, barClass: 'bg-rose-500/80 dark:bg-rose-400/70' },
  ] as const

  return (
    <div className={cn('space-y-2 text-xs', className)} role="group" aria-label="Why this score: contributing factors">
      {rows.map(({ label, value, barClass }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
          <div className="flex-1 min-w-0 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', barClass)}
              style={{ width: `${Math.min(100, value)}%` }}
              role="presentation"
            />
          </div>
          <span className="w-8 shrink-0 tabular-nums text-foreground text-right">{value}%</span>
        </div>
      ))}
    </div>
  )
}
