'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RiskListProps {
  risks: string[]
  loading?: boolean
  className?: string
}

export function RiskList({
  risks = [],
  loading = false,
  className,
}: RiskListProps) {
  const hasContent = risks.length > 0

  if (loading && !hasContent) {
    return (
      <section
        className={cn('rounded-lg border border-border bg-card p-4', className)}
        aria-label="Risks"
      >
        <div className="h-4 w-24 rounded bg-muted/60 animate-pulse mb-4" />
        <ul className="space-y-2">
          {[1, 2, 3].map((i) => (
            <li key={i} className="h-4 w-full rounded bg-muted/40 animate-pulse" />
          ))}
        </ul>
      </section>
    )
  }

  if (!hasContent) return null

  return (
    <section
      className={cn('rounded-lg border border-border bg-card p-4', className)}
      aria-label="Risks"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Risks
      </h2>
      <ul className="space-y-2 list-none pl-0">
        {risks.map((item, i) => (
          <li
            key={i}
            className="flex gap-2 text-sm text-foreground before:content-['•'] before:text-amber-500 before:font-bold before:shrink-0"
          >
            <span className="leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
