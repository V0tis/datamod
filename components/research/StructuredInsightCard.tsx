'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { InsightDataFreshness } from '@/components/insights/InsightDataFreshness'
import { MarkdownBody } from '@/components/ui/markdown-body'

export interface StructuredInsight {
  title: string
  /** Short summary (1–2 sentences) */
  summary: string
  /** 분석·수집 기준 시각 (ISO) — 신선도 배지 */
  sourceTimestamp?: string
  /** Impact: why this insight matters */
  impact?: string
  /** Reason / implication for product or PM action */
  reason?: string
  /** Why this insight matters (legacy; maps to impact if impact missing) */
  whyItMatters?: string
  /** Implication for product / PM action (legacy; maps to reason if reason missing) */
  implicationForProduct?: string
  /** Key metrics to highlight (e.g. "75/100", "시장 매력도 85점") */
  keyMetrics?: string[]
}

export interface StructuredInsightCardProps {
  insight: StructuredInsight
  className?: string
}

/** Extract key metrics (numbers, scores) from text for highlighting */
function extractKeyMetrics(text: string): string[] {
  const metrics: string[] = []
  const patterns = [
    /\d+\s*\/\s*100/g,
    /\d+%/g,
    /\d+점/g,
    /시장\s*매력도\s*\d+/g,
    /성장률\s*\d+/g,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) metrics.push(...m)
  }
  return [...new Set(metrics)].slice(0, 4)
}

/**
 * Structured insight card with 3-line preview and expandable detail.
 * Highlights key metrics.
 */
export function StructuredInsightCard({ insight, className }: StructuredInsightCardProps) {
  const [expanded, setExpanded] = useState(false)
  const impact = insight.impact ?? insight.whyItMatters ?? ''
  const reason = insight.reason ?? insight.implicationForProduct ?? ''
  const hasExtraSections = Boolean(impact || reason || insight.whyItMatters || insight.implicationForProduct)
  const hasLongSummary = insight.summary.length > 120
  const hasDetail = hasExtraSections || hasLongSummary
  const metrics = insight.keyMetrics ?? extractKeyMetrics(insight.summary + ' ' + impact + reason)
  const titleSameAsContents = insight.title.trim() === insight.summary.trim()
  const displayTitle = (insight.title || '').trim() || (insight.summary || '').trim().slice(0, 20) + '…'
  const displaySummary = (insight.summary || '').trim() || '분석 인사이트'
  const displayImpact = impact.trim()
  const displayReason = reason.trim()
  const showImpact = displayImpact.length > 0 && displayImpact !== '—'
  const showReason = displayReason.length > 0 && displayReason !== '—'

  return (
    <motion.div
      layout={false}
      role={hasDetail ? 'button' : undefined}
      tabIndex={hasDetail ? 0 : undefined}
      onClick={
        hasDetail
          ? () => setExpanded((e) => !e)
          : undefined
      }
      onKeyDown={
        hasDetail
          ? (ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                setExpanded((e) => !e)
              }
            }
          : undefined
      }
      className={cn(
        'rounded-xl border border-slate-100 bg-white shadow-sm transition-transform duration-200 dark:border-zinc-800 dark:bg-zinc-900',
        'hover:-translate-y-1 hover:border-slate-200 hover:shadow-md dark:hover:border-zinc-700',
        hasDetail && 'cursor-pointer',
        className
      )}
    >
      <div className="p-5 sm:p-5 md:p-6 lg:p-7">
        {(!titleSameAsContents || insight.sourceTimestamp) && (
          <div className="flex justify-between items-start gap-2 mb-1.5">
            <div className="min-w-0 flex-1">
              {!titleSameAsContents && (
                <h4 className="text-base font-semibold text-slate-900 leading-snug line-clamp-1 dark:text-zinc-50">
                  {displayTitle}
                </h4>
              )}
            </div>
            {insight.sourceTimestamp ? (
              <InsightDataFreshness iso={insight.sourceTimestamp} className="shrink-0 max-w-[11rem] text-right leading-tight" />
            ) : null}
          </div>
        )}
        <div
          className={cn(
            'line-clamp-3 [&_.rin-doc]:text-sm [&_.rin-doc]:text-slate-600 dark:[&_.rin-doc]:text-zinc-400',
            titleSameAsContents && '[&_.rin-doc]:text-slate-800 dark:[&_.rin-doc]:text-zinc-100'
          )}
        >
          <MarkdownBody className="text-sm leading-relaxed">{displaySummary}</MarkdownBody>
        </div>
        {showImpact && (
          <div className="mt-2 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">영향</div>
            <MarkdownBody className="text-sm text-slate-600 dark:text-zinc-400">{displayImpact}</MarkdownBody>
          </div>
        )}
        {showReason && (
          <div className="mt-2 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-500">근거 / 시사점</div>
            <MarkdownBody className="text-sm text-slate-600 dark:text-zinc-400">{displayReason}</MarkdownBody>
          </div>
        )}
        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {metrics.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center rounded-md border border-emerald-100/90 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                {m}
              </span>
            ))}
          </div>
        )}
        {hasDetail && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 -ml-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                접기 <ChevronUp className="w-3.5 h-3.5 ml-0.5" />
              </>
            ) : (
              <>
                자세히 보기 <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
              </>
            )}
          </Button>
        )}
      </div>

      {expanded && hasDetail && (
        <div
          className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6 lg:px-7 dark:border-zinc-800 dark:bg-zinc-900/40"
          onClick={(e) => e.stopPropagation()}
        >
          {hasLongSummary && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">인사이트 요약</div>
              <MarkdownBody className="text-sm">{insight.summary}</MarkdownBody>
            </div>
          )}
          {showImpact && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">영향</div>
              <MarkdownBody className="text-sm">{impact}</MarkdownBody>
            </div>
          )}
          {showReason && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">근거 / 시사점</div>
              <MarkdownBody className="text-sm">{reason}</MarkdownBody>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
