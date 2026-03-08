'use client'

import { cn } from '@/lib/utils'

interface SectionContentSkeletonProps {
  variant?: 'grid' | 'list' | 'mixed'
  className?: string
}

/**
 * Skeleton UI for pending analysis sections (Progressive Result UX).
 * Shown while waiting for each section's data.
 */
export function SectionContentSkeleton({ variant = 'grid', className }: SectionContentSkeletonProps) {
  if (variant === 'grid') {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3', className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" aria-hidden />
        ))}
      </div>
    )
  }
  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-4 w-4 shrink-0 rounded-full bg-muted/40 animate-pulse" aria-hidden />
            <div className="flex-1 h-5 rounded bg-muted/40 animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} aria-hidden />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" aria-hidden />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-4 rounded bg-muted/30 animate-pulse" style={{ width: `${70 + i * 5}%` }} aria-hidden />
        ))}
      </div>
    </div>
  )
}
