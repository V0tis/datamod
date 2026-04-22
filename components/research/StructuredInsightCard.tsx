'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp, Lightbulb, Paperclip } from 'lucide-react'
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
  /** 액션 우선순위 (예: core_insights.score 기반) */
  priority?: 'high' | 'mid' | 'low'
}

export interface StructuredInsightCardProps {
  insight: StructuredInsight
  className?: string
  /** 리스트형(구분선·여백) — 카드 테두리·그림자 없음 · masonry: 2열 우선순위 카드 */
  variant?: 'card' | 'list' | 'masonry'
}

const PRIORITY_STYLE: Record<'high' | 'mid' | 'low', { badge: string; label: string }> = {
  high: { badge: '#EF4444', label: '높은 우선순위' },
  mid: { badge: '#F59E0B', label: '중간 우선순위' },
  low: { badge: '#10B981', label: '낮은 우선순위' },
}

const PRIORITY_NEUTRAL = { badge: '#6B7280', label: '우선순위 미지정' }

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

function PriorityBadge({ priority }: { priority: 'high' | 'mid' | 'low' }) {
  const styles = {
    high: 'border-rose-200/90 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/45 dark:text-rose-100',
    mid: 'border-amber-200/90 bg-amber-50 text-amber-950 dark:border-amber-900/45 dark:bg-amber-950/40 dark:text-amber-100',
    low: 'border-slate-200/90 bg-slate-100 text-slate-800 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200',
  } as const
  const labels = { high: '높음', mid: '중간', low: '낮음' } as const
  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide',
        styles[priority]
      )}
    >
      {labels[priority]}
    </span>
  )
}

/**
 * Structured insight card with 3-line preview and expandable detail.
 * Highlights key metrics.
 */
export function StructuredInsightCard({
  insight,
  className,
  variant = 'card',
}: StructuredInsightCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isList = variant === 'list'
  const isMasonry = variant === 'masonry'
  const impact = insight.impact ?? insight.whyItMatters ?? ''
  const reason = insight.reason ?? insight.implicationForProduct ?? ''
  const hasExtraSections = Boolean(impact || reason || insight.whyItMatters || insight.implicationForProduct)
  const hasLongSummary = insight.summary.length > 120
  const metrics = insight.keyMetrics ?? extractKeyMetrics(insight.summary + ' ' + impact + reason)
  const hasMetrics = metrics.length > 0
  const titleSameAsContents = insight.title.trim() === insight.summary.trim()
  const displayTitle = (insight.title || '').trim() || (insight.summary || '').trim().slice(0, 20) + '…'
  const displaySummary = (insight.summary || '').trim() || '분석 인사이트'
  const displayImpact = impact.trim()
  const displayReason = reason.trim()
  const showImpact = displayImpact.length > 0 && displayImpact !== '—'
  const showReason = displayReason.length > 0 && displayReason !== '—'

  const listExpandable = showImpact || showReason || hasLongSummary || hasMetrics
  /** 카드형: 본문에 영향·근거를 두고, 펼침은 긴 요약 전체용 */
  const cardExpandable = hasLongSummary
  const hasDetail = isList ? listExpandable : cardExpandable

  const shellClass = isList
    ? cn(
        'border-b border-slate-100 py-6 last:border-b-0 dark:border-zinc-800/80',
        hasDetail && 'cursor-pointer',
        className
      )
    : cn(
        'rounded-lg border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900',
        hasDetail && 'cursor-pointer',
        className
      )

  const expandedPanel = (padList: boolean) => (
    <div
      className={cn(
        'space-y-3 border-t',
        padList ? 'mt-4 border-slate-100 bg-slate-50/50 px-0 py-4 dark:border-zinc-800 dark:bg-zinc-900/30' : 'border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6 lg:px-7 dark:border-zinc-800 dark:bg-zinc-900/40'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {hasLongSummary && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">인사이트 요약</div>
          <MarkdownBody className="text-sm">{insight.summary}</MarkdownBody>
        </div>
      )}
      {showImpact && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">영향</div>
          <MarkdownBody className="text-sm">{impact}</MarkdownBody>
        </div>
      )}
      {showReason && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">근거 / 시사점</div>
          <MarkdownBody className="text-sm">{reason}</MarkdownBody>
        </div>
      )}
      {hasMetrics && (
        <div className="flex flex-wrap gap-1.5">
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
    </div>
  )

  const listInner = (
    <>
      <div className="px-0">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {!titleSameAsContents && (
              <h4 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900 dark:text-zinc-50">
                {displayTitle}
              </h4>
            )}
          </div>
          {insight.sourceTimestamp ? (
            <InsightDataFreshness iso={insight.sourceTimestamp} className="max-w-[11rem] shrink-0 text-right text-[10px] leading-tight" />
          ) : null}
        </div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
          AI 코멘트
        </p>
        <div
          className={cn(
            'line-clamp-3 [&_.rin-doc]:text-sm [&_.rin-doc]:text-slate-600 dark:[&_.rin-doc]:text-zinc-400',
            titleSameAsContents && '[&_.rin-doc]:text-slate-800 dark:[&_.rin-doc]:text-zinc-100'
          )}
        >
          <MarkdownBody className="text-sm leading-relaxed">{displaySummary}</MarkdownBody>
        </div>
        {insight.priority ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
              우선순위
            </span>
            <PriorityBadge priority={insight.priority} />
          </div>
        ) : null}
        {listExpandable && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 h-7 -ml-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>
                접기 <ChevronUp className="ml-0.5 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                근거·지표 더보기 <ChevronDown className="ml-0.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </div>
      {expanded && listExpandable ? expandedPanel(true) : null}
    </>
  )

  const cardInner = (
    <>
      <div className={cn('p-5 sm:p-5 md:p-6 lg:p-7')}>
        {(!titleSameAsContents || insight.sourceTimestamp) && (
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {!titleSameAsContents && (
                <h4 className="line-clamp-1 text-base font-semibold leading-snug text-slate-900 dark:text-zinc-50">
                  {displayTitle}
                </h4>
              )}
            </div>
            {insight.sourceTimestamp ? (
              <InsightDataFreshness iso={insight.sourceTimestamp} className="max-w-[11rem] shrink-0 text-right leading-tight" />
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
        {insight.priority ? (
          <div className="mt-3">
            <PriorityBadge priority={insight.priority} />
          </div>
        ) : null}
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
        {hasMetrics && (
          <div className="mt-2 flex flex-wrap gap-1.5">
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
        {cardExpandable && (
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
                접기 <ChevronUp className="ml-0.5 h-3.5 w-3.5" />
              </>
            ) : (
              <>
                자세히 보기 <ChevronDown className="ml-0.5 h-3.5 w-3.5" />
              </>
            )}
          </Button>
        )}
      </div>

      {expanded && cardExpandable ? (
        <div
          className="space-y-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:px-6 lg:px-7 dark:border-zinc-800 dark:bg-zinc-900/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">인사이트 전체</div>
          <MarkdownBody className="text-sm">{insight.summary}</MarkdownBody>
        </div>
      ) : null}
    </>
  )

  const inner = isList ? listInner : cardInner

  const priorityVisual = insight.priority ? PRIORITY_STYLE[insight.priority] : PRIORITY_NEUTRAL

  const masonryShellClass = cn(
    'rounded-xl border p-5 transition-shadow hover:shadow-md border-l-4',
    insight.priority === 'high' &&
      'border-rose-200 bg-[#FFF1F0] border-l-rose-500 dark:border-rose-900/45 dark:bg-rose-950/30 dark:border-l-rose-500',
    insight.priority === 'mid' &&
      'border-amber-200 bg-[#FFFBEB] border-l-amber-500 dark:border-amber-900/45 dark:bg-amber-950/25 dark:border-l-amber-400',
    insight.priority === 'low' &&
      'border-emerald-200 bg-[#F0FFF4] border-l-emerald-500 dark:border-emerald-900/45 dark:bg-emerald-950/25 dark:border-l-emerald-500',
    !insight.priority && 'border-gray-200 bg-[#F9FAFB] border-l-gray-500 dark:border-zinc-700 dark:bg-zinc-950/90 dark:border-l-zinc-500',
    listExpandable && 'cursor-pointer'
  )

  const masonryInner = (
    <>
      <div
        className={masonryShellClass}
        role={listExpandable ? 'button' : undefined}
        tabIndex={listExpandable ? 0 : undefined}
        onClick={listExpandable ? () => setExpanded((e) => !e) : undefined}
        onKeyDown={
          listExpandable
            ? (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  setExpanded((e) => !e)
                }
              }
            : undefined
        }
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
              style={{ background: priorityVisual.badge }}
            >
              {priorityVisual.label}
            </span>
            {insight.sourceTimestamp ? (
              <InsightDataFreshness iso={insight.sourceTimestamp} className="text-[11px] text-gray-400 dark:text-zinc-500" />
            ) : null}
          </div>
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gray-300 dark:text-zinc-600" aria-hidden />
        </div>
        {!titleSameAsContents && (
          <h3 className="mb-2 text-base font-semibold leading-snug text-gray-900 dark:text-zinc-50">{displayTitle}</h3>
        )}
        <div className="mb-3 text-sm leading-relaxed text-gray-600 dark:text-zinc-400 [&_.rin-doc]:text-sm">
          <MarkdownBody className="text-sm leading-relaxed">{displaySummary}</MarkdownBody>
        </div>
        {hasMetrics ? (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {metrics.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white/80 px-2 py-1 text-xs text-gray-600 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-300"
              >
                <Paperclip className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                {m}
              </span>
            ))}
          </div>
        ) : null}
        {listExpandable ? (
          <button
            type="button"
            className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-sky-400 dark:hover:text-sky-300"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
          >
            근거·지표 보기
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        ) : null}
      </div>
      {expanded && listExpandable ? expandedPanel(true) : null}
    </>
  )

  if (isMasonry) {
    return (
      <article className={cn('break-inside-avoid', className)}>
        {masonryInner}
      </article>
    )
  }

  if (isList) {
    return (
      <article
        role={hasDetail ? 'button' : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onClick={hasDetail ? () => setExpanded((e) => !e) : undefined}
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
        className={shellClass}
      >
        {inner}
      </article>
    )
  }

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
      className={shellClass}
    >
      {inner}
    </motion.div>
  )
}
