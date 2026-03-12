'use client'

import { cn } from '@/lib/utils'

const shimmerClass = 'animate-skeleton-shimmer'

/**
 * Loading skeleton shown during analysis, before partial data arrives.
 * Shimmer animation indicates loading; reduces perceived wait time.
 */
export function AnalysisLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6 animate-in fade-in duration-200', className)} role="status" aria-label="분석 중">
      {/* Hero area skeleton */}
      <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
        <div className={cn('h-8 w-48 rounded-lg', shimmerClass)} aria-hidden />
        <div className="flex flex-wrap gap-4">
          <div className={cn('h-24 w-24 rounded-full', shimmerClass)} aria-hidden />
          <div className="flex-1 min-w-0 space-y-2">
            <div className={cn('h-4 w-full max-w-[200px] rounded', shimmerClass)} aria-hidden />
            <div className={cn('h-3 w-full max-w-[280px] rounded', shimmerClass)} aria-hidden />
          </div>
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
            <div className={cn('h-4 w-20 rounded', shimmerClass)} aria-hidden />
            <div className={cn('h-6 w-16 rounded', shimmerClass)} aria-hidden />
          </div>
        ))}
      </div>

      {/* Dashboard sections skeleton */}
      <div className="space-y-4">
        <div className={cn('h-6 w-32 rounded', shimmerClass)} aria-hidden />
        <div className="rounded-lg border border-border bg-muted/5 p-5 space-y-4">
          <div className={cn('h-4 w-full rounded', shimmerClass)} aria-hidden />
          <div className={cn('h-4 w-4/5 rounded', shimmerClass)} aria-hidden />
          <div className={cn('h-4 w-3/4 rounded', shimmerClass)} aria-hidden />
        </div>
        <div className="rounded-lg border border-border bg-muted/5 p-5 space-y-3">
          <div className={cn('h-4 w-full rounded', shimmerClass)} aria-hidden />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((i) => (
              <div key={i} className={cn('h-20 rounded-lg', shimmerClass)} aria-hidden />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">AI 분석을 진행하고 있습니다. 잠시만 기다려 주세요.</span>
    </div>
  )
}
