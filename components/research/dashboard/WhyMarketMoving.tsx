'use client'

import { Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface WhyMarketMovingProps {
  /** Top 3 drivers – short strings */
  drivers: string[]
  loading?: boolean
  className?: string
}

export function WhyMarketMoving({
  drivers = [],
  loading = false,
  className,
}: WhyMarketMovingProps) {
  const items = drivers.slice(0, 3)
  const hasContent = items.length > 0

  if (loading && !hasContent) {
    return (
      <section
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        aria-label="Why the market is moving"
      >
        <div className="h-4 w-48 rounded bg-muted/60 animate-pulse mb-4" />
        <ul className="space-y-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-3">
              <div className="h-6 w-6 rounded-full bg-muted/60 animate-pulse shrink-0" />
              <div className="h-4 flex-1 rounded bg-muted/40 animate-pulse" />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (!hasContent) return null

  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      aria-label="Why the market is moving"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4" />
        Why This Market Is Moving
      </h2>
      <ol className="space-y-3 list-none pl-0">
        {items.map((item, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <span className="text-sm text-foreground leading-relaxed">
              {item}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
