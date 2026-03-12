'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

export interface ResultPageSectionProps {
  id: string
  title: string
  description: string
  icon?: React.ReactNode
  children: React.ReactNode
  /** When true, section starts expanded */
  defaultOpen?: boolean
  className?: string
}

/**
 * A collapsible section with clear title and description for the results page.
 * Helps users quickly scan and understand key findings.
 */
export function ResultPageSection({
  id,
  title,
  description,
  icon,
  children,
  defaultOpen = false,
  className,
}: ResultPageSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section
        id={id}
        className={cn(
          'scroll-mt-24 rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm',
          className
        )}
        aria-label={title}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-4 p-4 sm:p-5 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl [&[data-state=open]]:rounded-b-none"
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-2">
                {icon && <span className="shrink-0 text-primary">{icon}</span>}
                {title}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            <span
              className={cn(
                'shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-muted/60 text-muted-foreground transition-transform duration-200',
                open && 'rotate-180'
              )}
              aria-hidden
            >
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border px-4 sm:px-5 py-4 sm:py-5 bg-muted/5">
            {children}
          </div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  )
}
