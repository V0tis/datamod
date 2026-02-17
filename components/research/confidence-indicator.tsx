'use client'

import { cn } from '@/lib/utils'
import type { ConfidenceDisplay, ConfidenceLevel } from '@/lib/confidence-display'

const LEVEL_STYLES: Record<
  ConfidenceLevel,
  { dot: string; label: string }
> = {
  high: {
    dot: 'bg-success',
    label: 'text-success',
  },
  medium: {
    dot: 'bg-warning',
    label: 'text-foreground',
  },
  low: {
    dot: 'bg-muted-foreground',
    label: 'text-muted-foreground',
  },
}

/**
 * Displays analysis confidence as a qualitative label + short rationale.
 * No numeric percentages; PM-friendly and works with dark/reading modes.
 */
export function ConfidenceIndicator({
  display,
  className,
  compact = false,
}: {
  display: ConfidenceDisplay
  className?: string
  /** When true, show single line: label + rationale (e.g. for tight layouts). */
  compact?: boolean
}) {
  const styles = LEVEL_STYLES[display.level]

  if (compact) {
    return (
      <p
        className={cn(
          'text-xs text-muted-foreground',
          className
        )}
        role="status"
        aria-label={`분석 신뢰도: ${display.label}. ${display.rationale}`}
      >
        <span className={cn('font-medium', styles.label)}>신뢰도 {display.label}</span>
        <span className="mx-1.5" aria-hidden>·</span>
        <span>{display.rationale}</span>
      </p>
    )
  }

  return (
    <div
      className={cn('text-xs', className)}
      role="status"
      aria-label={`분석 신뢰도: ${display.label}. ${display.rationale}`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)}
          aria-hidden
        />
        <span className={cn('font-medium text-muted-foreground', styles.label)}>
          신뢰도 {display.label}
        </span>
      </div>
      <p className="text-muted-foreground leading-snug pl-3">
        {display.rationale}
      </p>
    </div>
  )
}
