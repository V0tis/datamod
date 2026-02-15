'use client'

import { cn } from '@/lib/utils'

export interface SummaryBlockProps {
  /** Main headline — visible in ~5s */
  title: string
  /** Optional one-line lead (e.g. AI summary) */
  lead?: string | null
  /** Bullets or badges for key takeaways */
  items?: string[]
  /** Optional description above items */
  description?: string | null
  className?: string
  children?: React.ReactNode
}

/**
 * Above-the-fold block for key takeaways. Use for PM scan in ~5 seconds.
 */
export function SummaryBlock({
  title,
  lead,
  items = [],
  description,
  className,
  children,
}: SummaryBlockProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border dark:border-slate-800 bg-card dark:bg-slate-900/40 p-4 sm:p-5 md:p-6',
        'ring-1 ring-border/50 dark:ring-slate-700/50',
        className
      )}
      aria-labelledby="summary-block-title"
    >
      <h2
        id="summary-block-title"
        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground dark:text-slate-400 mb-2 sm:mb-3"
      >
        {title}
      </h2>
      {lead && (
        <p className="text-sm sm:text-base md:text-lg text-foreground dark:text-[#e1e3e6] leading-relaxed font-medium mb-3 sm:mb-4 break-words">
          {lead}
        </p>
      )}
      {description && !lead && (
        <p className="text-sm text-muted-foreground dark:text-slate-500 mb-3 sm:mb-4">{description}</p>
      )}
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 sm:gap-2 list-none p-0 m-0">
          {items.slice(0, 6).map((line, i) => (
            <li key={i} className="min-w-0 max-w-full">
              <span className="inline-block rounded-md border border-border dark:border-slate-700 bg-muted/50 dark:bg-slate-800/60 px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm text-foreground dark:text-slate-200 text-left break-words max-w-full">
                {line}
              </span>
            </li>
          ))}
        </ul>
      )}
      {children}
    </section>
  )
}
