'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus, ChevronDown } from 'lucide-react'

export interface InsightSummaryProps {
  /** The "So what?" one-sentence interpretation. Visually dominant. */
  summary: string
  /** Sentiment -100..100 (optional). Shown compactly. */
  sentimentScore?: number | null
  /** Trend for context */
  trend?: 'rising' | 'falling' | 'stable'
  /** Confidence 0..100 (optional) */
  confidence?: number | null
  /** Loading state: show placeholder */
  loading?: boolean
  className?: string
}

function TrendIcon({ trend }: { trend?: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
  if (trend === 'falling') return <TrendingDown className="w-4 h-4 text-rose-500 dark:text-rose-400" />
  return <Minus className="w-4 h-4 text-muted-foreground" />
}

/** Character count above which summary is truncated on small screens with "더 보기". */
const SUMMARY_TRUNCATE_THRESHOLD = 140

/**
 * Top-of-page "So what?" block. One sentence + optional sentiment/confidence.
 * AI interpretation only; no raw data. PMs see the answer in ~3 seconds.
 */
export function InsightSummary({
  summary,
  sentimentScore = null,
  trend = 'stable',
  confidence = null,
  loading = false,
  className,
}: InsightSummaryProps) {
  const hasMeta = sentimentScore != null || confidence != null
  const trendLabel = trend === 'rising' ? '상승' : trend === 'falling' ? '하락' : '보합'
  const isLong = (summary?.length ?? 0) > SUMMARY_TRUNCATE_THRESHOLD
  const [expanded, setExpanded] = useState(false)

  if (loading) {
    return (
      <section
        className={cn(
          'rounded-xl border border-primary/25 dark:border-emerald-500/40 bg-primary/5 dark:bg-emerald-500/5 border-l-4 border-l-primary dark:border-l-emerald-500 p-6 sm:p-7',
          className
        )}
        aria-label="Insight summary"
        aria-busy="true"
      >
        <p className="text-sm text-muted-foreground dark:text-slate-500 mb-3">한 줄 요약을 만드는 중입니다. 잠시만 기다려 주세요.</p>
        <div className="h-6 w-3/4 max-w-xl bg-muted dark:bg-slate-700/50 rounded animate-pulse mb-3" />
        <div className="h-4 w-1/2 max-w-sm bg-muted dark:bg-slate-700/40 rounded animate-pulse" />
      </section>
    )
  }

  return (
    <section
      className={cn(
        'rounded-xl border border-primary/25 dark:border-emerald-500/40 bg-primary/5 dark:bg-emerald-500/5 border-l-4 border-l-primary dark:border-l-emerald-500 pl-5 sm:pl-6 pr-5 sm:pr-6 py-6 sm:py-7',
        className
      )}
      aria-label="Insight summary"
    >
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground dark:text-slate-500 mb-3" aria-hidden>
        So what? — 한 줄 결론
      </p>
      <p
        className={cn(
          'text-lg sm:text-xl md:text-2xl font-semibold text-foreground dark:text-[#e1e3e6] leading-snug tracking-tight break-words',
          isLong && !expanded && 'line-clamp-3 sm:line-clamp-none'
        )}
      >
        {summary || '아직 요약이 준비되지 않았어요. 곧 표시될 거예요.'}
      </p>
      {isLong && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2.5 flex items-center gap-1 min-h-[44px] py-2 text-xs font-medium text-primary dark:text-emerald-400 hover:underline sm:hidden touch-manipulation"
          aria-label="요약 전체 보기"
        >
          더 보기 <ChevronDown className="w-3.5 h-3.5" />
        </button>
      )}
      {hasMeta && (
        <div className="mt-3 pt-3 border-t border-border/50 dark:border-slate-600/50 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground dark:text-slate-400">
          {sentimentScore != null && (
            <span className="inline-flex items-center gap-1.5">
              <TrendIcon trend={trend} />
              <span className="tabular-nums font-medium text-foreground dark:text-slate-300">
                감성 {sentimentScore > 0 ? '+' : ''}{sentimentScore}
              </span>
              <span className="text-xs">({trendLabel})</span>
            </span>
          )}
          {confidence != null && (
            <span className="tabular-nums">
              신뢰도 <strong className="text-foreground dark:text-slate-300">{Math.round(confidence)}%</strong>
            </span>
          )}
        </div>
      )}
    </section>
  )
}
