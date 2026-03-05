'use client'

import { CheckSquare, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ActionPhase {
  week: string
  items: string[]
}

export interface ActionPlanTimelineProps {
  phases: ActionPhase[]
  loading?: boolean
  className?: string
}

export function ActionPlanTimeline({
  phases = [],
  loading = false,
  className,
}: ActionPlanTimelineProps) {
  const hasContent = phases.length > 0 && phases.some((p) => p.items?.length > 0)

  if (loading && !hasContent) {
    return (
      <section
        className={cn('rounded-xl border border-border bg-card p-6', className)}
        aria-label="Action plan"
      >
        <div className="h-4 w-40 rounded bg-muted/60 animate-pulse mb-6" />
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className="h-4 w-20 rounded bg-muted/60 animate-pulse mb-3" />
              <ul className="space-y-2 pl-6">
                {[1, 2].map((j) => (
                  <li key={j} className="h-4 rounded bg-muted/40 animate-pulse" />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    )
  }

  if (!hasContent) return null

  return (
    <section
      className={cn('rounded-xl border border-border bg-card p-6', className)}
      aria-label="Action plan for PM"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-6">
        <CheckSquare className="h-4 w-4" />
        Action Plan for PM
      </h2>
      <div className="space-y-6">
        {phases.map((phase, i) => (
          <div key={i}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">
                {phase.week}
              </span>
            </div>
            <ul className="space-y-2 pl-6 list-disc text-sm text-foreground">
              {phase.items.map((item, j) => (
                <li key={j} className="leading-relaxed">{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
