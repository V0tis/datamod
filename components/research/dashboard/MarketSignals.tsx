'use client'

import { Activity } from 'lucide-react'
import { SignalCard } from './SignalCard'
import { cn } from '@/lib/utils'

export interface SignalItem {
  label: string
  value?: string
  trend: 'rising' | 'stable' | 'declining'
  status?: 'positive' | 'neutral' | 'negative'
}

export interface MarketSignalsProps {
  signals: SignalItem[]
  loading?: boolean
  className?: string
}

/** Displays signals as structured cards, not long text. */
export function MarketSignals({
  signals = [],
  loading = false,
  className,
}: MarketSignalsProps) {
  const hasContent = signals.length > 0

  if (loading && !hasContent) {
    return (
      <section
        className={cn('rounded-xl border border-border bg-card p-6', className)}
        aria-label="Market signals"
      >
        <div className="h-4 w-32 rounded bg-muted/60 animate-pulse mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (!hasContent) return null

  const statusFromTrend = (t: SignalItem['trend']) =>
    t === 'rising' ? 'positive' : t === 'declining' ? 'negative' : 'neutral'

  return (
    <section
      className={cn('rounded-xl border border-border bg-card p-6', className)}
      aria-label="Market signals"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
        <Activity className="h-4 w-4" />
        Market Signals
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {signals.map((sig, i) => (
          <SignalCard
            key={i}
            label={sig.label}
            value={sig.value}
            trend={sig.trend}
            status={sig.status ?? statusFromTrend(sig.trend)}
          />
        ))}
      </div>
    </section>
  )
}
