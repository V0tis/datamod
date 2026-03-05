'use client'

import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Suggested keywords for first-time or empty-state users */
export const SUGGESTED_ANALYSES = [
  'AI Meeting Assistants',
  'Creator Economy Tools',
  'AI Coding Assistants',
  'AI Video Generation',
] as const

export interface SuggestedAnalysesProps {
  onSelect: (keyword: string) => void
  disabled?: boolean
  className?: string
}

export function SuggestedAnalyses({
  onSelect,
  disabled = false,
  className,
}: SuggestedAnalysesProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        Suggested analyses
      </p>
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_ANALYSES.map((keyword) => (
          <button
            key={keyword}
            type="button"
            onClick={() => onSelect(keyword)}
            disabled={disabled}
            className={cn(
              'rounded-md border border-border/80 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors',
              'hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {keyword}
          </button>
        ))}
      </div>
    </div>
  )
}
