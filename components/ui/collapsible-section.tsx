'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CollapsibleSectionProps {
  title: string
  /** Optional icon component to show before title */
  icon?: React.ReactNode
  /** Default expanded state */
  defaultExpanded?: boolean
  children: React.ReactNode
  className?: string
  /** Whether section has content (if false, may hide or show empty state) */
  hasContent?: boolean
}

export function CollapsibleSection({
  title,
  icon,
  defaultExpanded = true,
  children,
  className,
  hasContent = true,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <section
      className={cn(
        'rounded-xl border border-border bg-card shadow-sm overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          'w-full flex items-center justify-between gap-3 min-h-[52px] px-4 sm:px-5 py-3',
          'text-left hover:bg-muted/40 transition-colors touch-manipulation',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon && <span className="shrink-0 text-primary">{icon}</span>}
          <h3 className="text-sm font-semibold text-foreground truncate">
            {title}
          </h3>
        </div>
        <ChevronDown
          className={cn(
            'w-5 h-5 shrink-0 text-muted-foreground transition-transform duration-200',
            expanded && 'rotate-180'
          )}
          aria-hidden
        />
      </button>
      {expanded && (
        <div
          className={cn(
            'border-t border-border/60 animate-in fade-in slide-in-from-top-1 duration-200'
          )}
        >
          <div className="p-4 sm:p-5">
            {hasContent ? (
              children
            ) : (
              <p className="text-sm text-muted-foreground">분석 완료 후 표시됩니다.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
