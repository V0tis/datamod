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

/** Number of items shown before "더 보기" on small screens; rest expand on tap. */
const INITIAL_VISIBLE_ITEMS = 3

/**
 * Key takeaways as a scannable list. Appears right after InsightSummary.
 * Use for action items or key conclusions — decisions, not raw data.
 */
export function KeyFindings({
  items,
  title = '핵심 정리',
  maxItems = 5,
  className,
}: KeyFindingsProps) {
  const [showAll, setShowAll] = useState(false)
  const list = items.slice(0, maxItems).filter(Boolean)
  if (list.length === 0) return null

  const hasMore = list.length > INITIAL_VISIBLE_ITEMS
  const visibleList = showAll || !hasMore ? list : list.slice(0, INITIAL_VISIBLE_ITEMS)

  return (
    <section
      className={cn('rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900/40 p-4 sm:p-5', className)}
      aria-label="Key findings"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400 mb-3.5">
        {title}
      </h2>
      <ul className="list-none pl-0 space-y-3">
        {visibleList.map((item, i) => (
          <li key={i} className="flex gap-3 text-sm text-foreground dark:text-slate-200 leading-relaxed break-words">
            <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-primary/15 dark:bg-emerald-500/20 text-primary dark:text-emerald-400 flex items-center justify-center text-xs font-bold tabular-nums">
              {i + 1}
            </span>
            <span className="font-medium">{item}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3.5 flex items-center gap-1.5 min-h-[44px] py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground dark:hover:text-slate-300 touch-manipulation"
          aria-expanded={showAll}
          aria-label={showAll ? '핵심 정리 접기' : '나머지 항목 펼치기'}
        >
          {showAll ? (
            <>
              접기 <ChevronUp className="w-3.5 h-3.5 shrink-0" />
            </>
          ) : (
            <>
              더 보기 ({list.length - INITIAL_VISIBLE_ITEMS}개) <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </>
          )}
        </button>
      )}
    </section>
  )
}
