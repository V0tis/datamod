'use client'

import { cn } from '@/lib/utils'
import { Lightbulb } from 'lucide-react'

export interface KeyInsightBulletCardProps {
  /** Insight text - kept concise, no long paragraphs */
  title: string
  /** Optional index badge (1, 2, 3) */
  index?: number
  className?: string
}

/**
 * Card for a single key insight. Used in Key Insights section.
 * Always short, scannable - no raw AI paragraphs.
 */
export function KeyInsightBulletCard({
  title,
  index,
  className,
}: KeyInsightBulletCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4 flex gap-3',
        'transition-colors hover:border-primary/30',
        className
      )}
    >
      {index != null && (
        <div
          className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary"
          aria-hidden
        >
          {index}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground leading-snug line-clamp-3">
          {title}
        </p>
      </div>
      <Lightbulb className="w-4 h-4 shrink-0 text-primary/60 mt-0.5" aria-hidden />
    </div>
  )
}
