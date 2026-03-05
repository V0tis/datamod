'use client'

import { Target } from 'lucide-react'
import { OpportunityCard } from './OpportunityCard'
import { cn } from '@/lib/utils'

export interface OpportunityItem {
  title: string
  description?: string
  reason?: string
}

export interface OpportunitiesPanelProps {
  opportunities: OpportunityItem[]
  loading?: boolean
  className?: string
}

/** Displays 3 strategic opportunities as cards. */
export function OpportunitiesPanel({
  opportunities = [],
  loading = false,
  className,
}: OpportunitiesPanelProps) {
  const items = opportunities.slice(0, 3)
  const hasContent = items.length > 0

  if (loading && !hasContent) {
    return (
      <section
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        aria-label="Strategic opportunities"
      >
        <div className="h-4 w-40 rounded bg-muted/60 animate-pulse mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      </section>
    )
  }

  if (!hasContent) return null

  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      aria-label="Strategic opportunities"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
        <Target className="h-4 w-4" />
        Strategic Opportunities
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((opp, i) => (
          <OpportunityCard
            key={i}
            title={opp.title}
            description={opp.description}
            reason={opp.reason}
          />
        ))}
      </div>
    </section>
  )
}
