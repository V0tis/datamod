'use client'

import { cn } from '@/lib/utils'

export type PMSectionLabel = 'Problem' | 'Signal' | 'Insight' | 'Implication'

const LABEL_STYLES: Record<PMSectionLabel, string> = {
  Problem: 'text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10',
  Signal: 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10',
  Insight: 'text-emerald-600 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  Implication: 'text-blue-600 dark:text-blue-400 border-blue-500/40 bg-blue-500/10',
}

export interface InsightCardProps {
  /** PM thinking frame */
  label: PMSectionLabel
  /** Card title */
  title: string
  children: React.ReactNode
  className?: string
}

/**
 * Reusable card for PM-framed sections (Problem / Signal / Insight / Implication).
 */
export function InsightCard({ label, title, children, className }: InsightCardProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900/50 p-4 sm:p-5',
        'transition-colors duration-200 min-w-0',
        className
      )}
      aria-labelledby={`insight-card-${label}-title`}
    >
      <div
        className={cn(
          'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider mb-2 sm:mb-3',
          LABEL_STYLES[label]
        )}
      >
        {label}
      </div>
      <h3
        id={`insight-card-${label}-title`}
        className="text-sm font-semibold text-foreground dark:text-slate-200 mb-2 sm:mb-3 tracking-tight break-words"
      >
        {title}
      </h3>
      <div className="text-sm text-muted-foreground dark:text-slate-300 leading-relaxed break-words [&_ul]:space-y-1.5 [&_ul]:list-disc [&_ul]:pl-4">
        {children}
      </div>
    </section>
  )
}
