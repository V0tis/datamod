'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp } from 'lucide-react'

export interface KeyFindingsProps {
  /** 3–5 key takeaways. Shown first so PMs don't dig through long text. */
  items: string[]
  /** Optional section title */
  title?: string
  /** Max items to show (default 5) */
  maxItems?: number
  className?: string
}

/**
 * Key takeaways as a scannable list. Appears right after InsightSummary.
 * Use for action items or key conclusions — decisions, not raw data.
 */
export function KeyFindings({
  items,
  title = 'Key findings',
  maxItems = 5,
  className,
}: KeyFindingsProps) {
  const list = items.slice(0, maxItems).filter(Boolean)
  if (list.length === 0) return null

  const initialVisible = 3
  const hasMore = list.length > initialVisible
  const [showAll, setShowAll] = useState(false)
  const visibleList = showAll || !hasMore ? list : list.slice(0, initialVisible)

  return (
    <section
      className={cn('rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900/40 p-4 sm:p-5', className)}
      aria-label="Key findings"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400 mb-3">
        {title}
      </h2>
      <ul className="list-none pl-0 space-y-2">
        {visibleList.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-foreground dark:text-slate-200 leading-relaxed break-words">
            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-primary/15 dark:bg-emerald-500/20 text-primary dark:text-emerald-400 flex items-center justify-center text-xs font-semibold">
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-slate-300 md:mt-2"
          aria-expanded={showAll}
        >
          {showAll ? (
            <>
              접기 <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            </>
          ) : (
            <>
              더 보기 ({list.length - initialVisible}개) <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </>
          )}
        </button>
      )}
    </section>
  )
}
