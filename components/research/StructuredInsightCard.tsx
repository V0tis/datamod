'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface StructuredInsight {
  title: string
  /** Short summary (1–2 sentences) */
  summary: string
  /** Why this insight matters */
  whyItMatters?: string
  /** Implication for product / PM action */
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
  const hasExtraSections = Boolean(insight.whyItMatters || insight.implicationForProduct)
  const hasLongSummary = insight.summary.length > 120
  const hasDetail = hasExtraSections || hasLongSummary
  const metrics = insight.keyMetrics ?? extractKeyMetrics(insight.summary + ' ' + (insight.whyItMatters ?? '') + (insight.implicationForProduct ?? ''))

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card transition-colors hover:border-primary/30 hover:bg-primary/[0.02]',
        className
      )}
    >
      {/* Preview: Title + Summary (max 3 lines) */}
      <div className="p-4 sm:p-5">
        <h4 className="text-sm font-semibold text-foreground leading-snug mb-1.5 line-clamp-1">
          {insight.title}
        </h4>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-3">
          <TextWithHighlights text={insight.summary} keyMetrics={metrics.length ? metrics : undefined} />
        </p>
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

      {/* Expanded detail */}
      {expanded && hasDetail && (
        <div className="border-t border-border/60 px-4 sm:px-5 py-3 space-y-3 bg-muted/20">
          {hasLongSummary && !hasExtraSections && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Insight Summary
              </p>
              <p className="text-sm text-foreground leading-relaxed">{insight.summary}</p>
            </div>
          )}
          {insight.whyItMatters && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Why It Matters
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                <TextWithHighlights text={insight.whyItMatters} keyMetrics={metrics} />
              </p>
            </div>
          )}
          {insight.implicationForProduct && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Implication for Product
              </p>
              <p className="text-sm text-foreground leading-relaxed">
                <TextWithHighlights text={insight.implicationForProduct} keyMetrics={metrics} />
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
