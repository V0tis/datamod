'use client'

import { cn } from '@/lib/utils'

export interface ProductStrategySectionProps {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
}

/**
 * Section wrapper for product strategy report. Visually separated, scannable.
 */
export function ProductStrategySection({
  title,
  icon,
  children,
  className,
}: ProductStrategySectionProps) {
  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden',
        className
      )}
      aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-border/60 bg-muted/20">
        <h2
          id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="text-sm font-semibold text-foreground flex items-center gap-2"
        >
          {icon}
          {title}
        </h2>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}
