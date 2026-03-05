'use client'

import { CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PMActionPlanSectionProps {
  /** Flattened action items (strings) */
  actions?: string[]
  /** Or structured phases (week + items) */
  phases?: Array<{ week?: string; items: string[] }>
  loading?: boolean
  className?: string
}

export function PMActionPlanSection({
  actions = [],
  phases = [],
  loading = false,
  className,
}: PMActionPlanSectionProps) {
  const flatActions =
    actions.length > 0
      ? actions
      : phases.flatMap((p) => p.items).filter(Boolean)
  const hasContent = flatActions.length > 0

  if (loading && !hasContent) {
    return (
      <section
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
          className
        )}
        aria-label="실행 전략"
      >
        <div className="p-6 sm:p-8">
          <div className="h-4 w-32 rounded bg-muted/60 animate-pulse mb-6" />
          <ul className="space-y-3 pl-5">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="h-4 rounded bg-muted/40 animate-pulse" />
            ))}
          </ul>
        </div>
      </section>
    )
  }

  if (!hasContent) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        className
      )}
      aria-label="PM Action Plan"
    >
      <div className="p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <CheckSquare className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Action Plan
          </h2>
        </div>

        <ul className="space-y-3">
          {flatActions.slice(0, 10).map((action, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden
              />
              <span className="leading-relaxed">{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
