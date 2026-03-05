'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SignalCardProps {
  label: string
  status: 'positive' | 'neutral' | 'negative'
  trend?: 'rising' | 'stable' | 'declining'
  value?: string
  className?: string
}

const STATUS_STYLES = {
  positive: 'border-emerald-500/30 bg-emerald-500/5',
  neutral: 'border-amber-500/20 bg-amber-500/5',
  negative: 'border-red-500/20 bg-red-500/5',
} as const

const TREND_ICONS = {
  rising: TrendingUp,
  stable: Minus,
  declining: TrendingDown,
} as const

export function SignalCard({
  label,
  status,
  trend = 'stable',
  value,
  className,
}: SignalCardProps) {
  const TrendIcon = TREND_ICONS[trend]

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        STATUS_STYLES[status],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <TrendIcon
          className={cn(
            'h-4 w-4 shrink-0',
            trend === 'rising' && 'text-emerald-600',
            trend === 'declining' && 'text-amber-600',
            trend === 'stable' && 'text-muted-foreground'
          )}
          aria-hidden
        />
      </div>
      {value && (
        <p className="mt-1 text-xs text-muted-foreground">{value}</p>
      )}
    </div>
  )
}
