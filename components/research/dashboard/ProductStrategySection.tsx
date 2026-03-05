'use client'

import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProductStrategySectionProps {
  /** Market opportunity summary / strategy summary from AI */
  summary?: string | null
  /** Key opportunities (also used for target users when structured) */
  opportunities?: string[]
  /** Strategic positioning / key product direction */
  keyConclusions?: string[]
  /** Target users (e.g. Early adopters) */
  targetUsers?: string | null
  /** Core value proposition */
  valueProposition?: string | null
  loading?: boolean
  className?: string
}

export function ProductStrategySection({
  summary,
  opportunities = [],
  keyConclusions = [],
  targetUsers,
  valueProposition,
  loading = false,
  className,
}: ProductStrategySectionProps) {
  const hasSummary = Boolean(summary?.trim())
  const hasOpportunities = opportunities.length > 0
  const hasConclusions = keyConclusions.length > 0
  const hasTargetUsers = Boolean(targetUsers?.trim())
  const hasValueProp = Boolean(valueProposition?.trim())
  const hasContent = hasSummary || hasOpportunities || hasConclusions || hasTargetUsers || hasValueProp

  if (loading && !hasContent) {
    return (
      <section
        className={cn(
          'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
          className
        )}
        aria-label="제품 전략 제안"
      >
        <div className="p-4 sm:p-5">
          <div className="h-4 w-32 rounded bg-muted/60 animate-pulse mb-4" />
          <div className="space-y-3">
            <div className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/30 animate-pulse" />
            <div className="h-4 w-4/5 rounded bg-muted/30 animate-pulse" />
          </div>
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
      aria-label="Product Strategy"
    >
      <div className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
            Strategy
          </h2>
        </div>

        <div className="space-y-4">
          {(hasTargetUsers || hasValueProp) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {hasTargetUsers && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Target users</p>
                  <p className="text-sm text-foreground">{targetUsers!.trim()}</p>
                </div>
              )}
              {hasValueProp && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Core value proposition</p>
                  <p className="text-sm text-foreground">{valueProposition!.trim()}</p>
                </div>
              )}
            </div>
          )}
          {hasSummary && (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-4 sm:p-5">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {summary!.trim()}
              </p>
            </div>
          )}

          {hasOpportunities && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Market opportunities
              </h3>
              <ul className="space-y-2">
                {opportunities.slice(0, 5).map((opp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{opp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hasConclusions && (
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Key product direction
              </h3>
              <ul className="space-y-2">
                {keyConclusions.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
