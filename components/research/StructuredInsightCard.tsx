'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { motionConfig } from '@/lib/motion-config'

export interface StructuredInsight {
  title: string
  /** Short summary (1–2 sentences) */
  summary: string
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

/** Render text with key metrics highlighted */
function TextWithHighlights({ text, keyMetrics }: { text: string; keyMetrics?: string[] }) {
  if (!keyMetrics?.length) return <>{text}</>
  const escaped = keyMetrics.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const re = new RegExp(`(${escaped})`, 'g')
  const parts = text.split(re).map((seg, i) =>
    keyMetrics.includes(seg) ? (
      <mark key={i} className="bg-primary/20 text-primary font-semibold rounded px-0.5">
        {seg}
      </mark>
    ) : (
      seg
    )
  )
  return <>{parts}</>
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
      whileHover={{
        y: motionConfig.cardHover.y,
        transition: motionConfig.cardHover.transition,
      }}
      className={cn(
        'rounded-xl border border-border/60 bg-card shadow-sm',
        'hover:border-primary/30 hover:bg-primary/[0.02] hover:shadow-md',
        className
      )}
    >
      <div className="p-4 sm:p-5">
        {!titleSameAsContents && (
          <h4 className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-1">
            {displayTitle}
          </h4>
        )}
        <p className={cn('text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3', titleSameAsContents && 'text-foreground')}>
          <TextWithHighlights text={displaySummary} keyMetrics={metrics.length ? metrics : undefined} />
        </p>
        {showImpact && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">영향</p>
            <p className="text-xs text-foreground leading-relaxed">{displayImpact}</p>
          </div>
        )}
        {showReason && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">근거 / 시사점</p>
            <p className="text-xs text-foreground leading-relaxed">{displayReason}</p>
          </div>
        )}
        {metrics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {metrics.map((m, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/15 text-primary text-[11px] font-semibold"
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
            className="mt-2 h-7 text-xs text-primary hover:bg-primary/10 -ml-1"
            onClick={() => setExpanded((e) => !e)}
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
        <div className="border-t border-border/60 px-4 sm:px-5 py-3 space-y-3 bg-muted/20">
          {hasLongSummary && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">인사이트 요약</p>
              <p className="text-sm text-foreground leading-relaxed">{insight.summary}</p>
            </div>
          )}
          {showImpact && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">영향</p>
              <p className="text-sm text-foreground leading-relaxed"><TextWithHighlights text={impact} keyMetrics={metrics} /></p>
            </div>
          )}
          {showReason && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">근거 / 시사점</p>
              <p className="text-sm text-foreground leading-relaxed"><TextWithHighlights text={reason} keyMetrics={metrics} /></p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}
