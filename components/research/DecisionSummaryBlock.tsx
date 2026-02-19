'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DecisionSummaryBlockProps {
  summary: string
  marketDirection?: 'rising' | 'stable' | 'declining'
  interpretation?: string
  loading?: boolean
  /** Large one-line style for executive summary */
  executiveStyle?: boolean
  className?: string
}

/** Decision summary: 2–3 sentence AI summary, market direction, short interpretation. */
export function DecisionSummaryBlock({
  summary,
  marketDirection = 'stable',
  interpretation,
  loading = false,
  executiveStyle = false,
  className,
}: DecisionSummaryBlockProps) {
  const directionLabels = { rising: '상승', stable: '보합', declining: '하락' }
  const DirectionIcon = marketDirection === 'rising' ? TrendingUp : marketDirection === 'declining' ? TrendingDown : Minus

  if (loading) {
    return (
      <section className={cn('rounded-lg border border-border/60 bg-background/50 p-4 sm:p-5', className)} aria-label="Decision summary">
        <div className="space-y-3">
          <div className="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
          <div className="h-4 w-full rounded bg-muted/60 animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
        </div>
      </section>
    )
  }

  return (
    <section className={cn('rounded-lg border border-border/60 bg-background/50 p-4 sm:p-5', className)} aria-label="Decision summary">
      <p className={cn('text-foreground leading-relaxed', executiveStyle ? 'text-lg sm:text-xl font-semibold' : 'text-sm sm:text-base')}>{summary || '—'}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <DirectionIcon className="w-4 h-4" aria-hidden />
          {directionLabels[marketDirection]}
        </span>
        {interpretation && (
          <span className="text-xs text-muted-foreground">· {interpretation}</span>
        )}
      </div>
    </section>
  )
}
