'use client'

import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OpportunityCardProps {
  title: string
  description?: string
  reason?: string
  /** @deprecated Use description */
  explanation?: string
  /** @deprecated Use reason */
  reasoning?: string
  className?: string
}

export function OpportunityCard({
  title,
  description,
  reason,
  explanation,
  reasoning,
  className,
}: OpportunityCardProps) {
  const desc = description ?? explanation
  const rsn = reason ?? reasoning
  return (
    <div
      className={cn(
        'rounded-lg border border-primary/20 bg-primary/5 p-4',
        className
      )}
    >
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary shrink-0" />
        {title}
      </h3>
      {desc && (
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {desc}
        </p>
      )}
      {rsn && (
        <p className="mt-2 text-xs text-muted-foreground/90 border-l-2 border-primary/30 pl-3 italic">
          {rsn}
        </p>
      )}
    </div>
  )
}
