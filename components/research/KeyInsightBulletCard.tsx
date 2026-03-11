'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface KeyInsightBulletCardProps {
  /** Insight text */
  title: string
  /** Optional index badge (1, 2, 3) */
  index?: number
  className?: string
}

/**
 * Card for a single key insight. Max 3 lines preview, expandable detail.
 */
export function KeyInsightBulletCard({
  title,
  index,
  className,
}: KeyInsightBulletCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = title.length > 120

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
        <p
          className={cn(
            'text-sm font-medium text-foreground leading-snug',
            !expanded && 'line-clamp-3'
          )}
        >
          {title}
        </p>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 text-xs text-primary hover:bg-primary/10 -ml-1"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>접기 <ChevronUp className="w-3 h-3 ml-0.5" /></>
            ) : (
              <>자세히 보기 <ChevronDown className="w-3 h-3 ml-0.5" /></>
            )}
          </Button>
        )}
      </div>
      <Lightbulb className="w-4 h-4 shrink-0 text-primary/60 mt-0.5" aria-hidden />
    </div>
  )
}
