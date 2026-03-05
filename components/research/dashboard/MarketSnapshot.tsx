'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MarketSnapshotProps {
  /** 0–100 market temperature score */
  score: number | null
  /** Trend direction */
  trend?: 'rising' | 'stable' | 'declining'
  /** Number of signals detected */
  signalCount?: number
  /** Confidence 0–100 */
  confidence?: number | null
  loading?: boolean
  className?: string
}

const TREND_LABELS = { rising: '상승', stable: '보합', declining: '하락' } as const

export function MarketSnapshot({
  score,
  trend = 'stable',
  signalCount = 0,
  confidence = null,
  loading = false,
  className,
}: MarketSnapshotProps) {
  const hasScore = score != null && Number.isFinite(score)
  const norm = hasScore ? Math.round(Math.min(100, Math.max(0, score))) : null
  const TrendIcon = trend === 'rising' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus

  if (loading && !hasScore) {
    return (
      <section
        className={cn(
          'rounded-lg border border-border bg-card p-4 shadow-sm',
          className
        )}
        aria-label="Market snapshot"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-muted/60 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-24 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted/40 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-sm',
        className
      )}
      aria-label="Market snapshot"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
            Market Temperature
          </p>
          <p className="text-4xl sm:text-5xl font-bold tabular-nums text-foreground">
            {norm ?? '—'}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              Trend
            </p>
            <div className="flex items-center gap-2">
              <TrendIcon
                className={cn(
                  'h-4 w-4',
                  trend === 'rising' && 'text-emerald-600',
                  trend === 'declining' && 'text-amber-600',
                  trend === 'stable' && 'text-muted-foreground'
                )}
              />
              <span className="text-sm font-semibold text-foreground">
                {TREND_LABELS[trend]}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              Signals
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {signalCount}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              Confidence
            </p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {confidence != null ? `${confidence}%` : '—'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
