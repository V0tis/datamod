'use client'

import { cn } from '@/lib/utils'
import type { AnalysisQualityScore, QualityConfidenceLabel } from '@/lib/analysis-quality-score'

const LABEL_STYLES: Record<QualityConfidenceLabel, { dot: string; text: string }> = {
  High: { dot: 'bg-success', text: 'text-success' },
  Medium: { dot: 'bg-primary/80', text: 'text-foreground' },
  Low: { dot: 'bg-warning', text: 'text-warning' },
  Weak: { dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

const LABEL_KO: Record<QualityConfidenceLabel, string> = {
  High: '높음',
  Medium: '보통',
  Low: '낮음',
  Weak: '취약',
}

/**
 * Displays analysis quality score (trustworthiness metric).
 * Not factual correctness; explains why this score was assigned.
 */
export function AnalysisQualityIndicator({
  quality,
  compact = false,
  className,
}: {
  quality: AnalysisQualityScore
  compact?: boolean
  className?: string
}) {
  const label = quality.label as QualityConfidenceLabel
  const styles = LABEL_STYLES[label] ?? LABEL_STYLES.Weak
  const labelKo = LABEL_KO[label] ?? quality.label

  if (compact) {
    return (
      <p
        className={cn('text-xs text-muted-foreground', className)}
        role="status"
        aria-label={`분석 품질: ${quality.score}/100 (${labelKo}). ${quality.explanation}`}
      >
        <span className={cn('font-medium', styles.text)}>품질 {quality.score}/100 · {labelKo}</span>
        <span className="mx-1.5" aria-hidden>·</span>
        <span>{quality.explanation}</span>
      </p>
    )
  }

  return (
    <div
      className={cn('text-xs', className)}
      role="status"
      aria-label={`분석 품질: ${quality.score}/100 (${labelKo}). ${quality.explanation}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)}
          aria-hidden
        />
        <span className={cn('font-medium', styles.text)}>
          품질 {quality.score}/100 · {labelKo}
        </span>
      </div>
      <p className="text-muted-foreground leading-snug pl-3">
        {quality.explanation}
      </p>
    </div>
  )
}
