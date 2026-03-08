'use client'

import { cn } from '@/lib/utils'

export interface InsightCardProps {
  title: string
  explanation: string
  className?: string
}

/**
 * Short, scannable insight card: title + explanation.
 */
export function InsightCard({ title, explanation, className }: InsightCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card p-4 sm:p-5 transition-colors hover:border-primary/30 hover:bg-primary/[0.03]',
        className
      )}
    >
      <h4 className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-2">
        {title}
      </h4>
      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
        {explanation}
      </p>
    </div>
  )
}
