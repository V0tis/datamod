'use client'

import { cn } from '@/lib/utils'

export type ResultDepthLayout = 'fast' | 'standard' | 'deep'

const BADGE_COPY: Record<ResultDepthLayout, { en: string; ko: string; className: string }> = {
  fast: {
    en: 'Fast Analysis Applied',
    ko: '빠른 분석 적용',
    className: 'border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100',
  },
  standard: {
    en: 'Standard Analysis Applied',
    ko: '표준 분석 적용',
    className: 'border-slate-200/90 bg-slate-50/95 text-slate-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-100',
  },
  deep: {
    en: 'Deep Analysis Applied',
    ko: '심층 분석 적용',
    className: 'border-indigo-300/80 bg-indigo-50/95 text-indigo-950 dark:border-indigo-800/50 dark:bg-indigo-950/50 dark:text-indigo-100',
  },
}

export function AnalysisDepthQualityBadge({
  depth,
  className,
}: {
  depth: ResultDepthLayout
  className?: string
}) {
  const b = BADGE_COPY[depth]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        b.className,
        className
      )}
      title={b.ko}
    >
      <span className="opacity-90" aria-hidden>
        ✓
      </span>
      {b.en}
    </span>
  )
}
