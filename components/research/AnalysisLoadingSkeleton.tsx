'use client'

import { cn } from '@/lib/utils'

/**
 * Loading skeleton shown during analysis, before partial data arrives.
 * Prevents blank flash and communicates progress.
 */
export function AnalysisLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6 animate-in fade-in duration-200', className)} role="status" aria-label="분석 중">
      {/* Hero area skeleton */}
      <div className="rounded-xl border border-border bg-card/50 p-5 space-y-4">
        <div className="h-8 w-48 bg-muted/50 rounded-lg animate-pulse" />
        <div className="flex flex-wrap gap-4">
          <div className="h-24 w-24 rounded-full bg-muted/40 animate-pulse" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="h-4 w-full max-w-[200px] bg-muted/50 rounded animate-pulse" />
            <div className="h-3 w-full max-w-[280px] bg-muted/40 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-muted/10 p-4 animate-pulse">
            <div className="h-4 w-20 bg-muted/50 rounded mb-3" />
            <div className="h-6 w-16 bg-muted/40 rounded" />
          </div>
        ))}
      </div>

      {/* Dashboard sections skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-32 bg-muted/50 rounded animate-pulse" />
        <div className="rounded-lg border border-border bg-muted/5 p-5 space-y-4">
          <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
          <div className="h-4 w-4/5 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-muted/30 rounded animate-pulse" />
        </div>
        <div className="rounded-lg border border-border bg-muted/5 p-5 space-y-3">
          <div className="h-4 w-full bg-muted/40 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/20 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">AI 분석을 진행하고 있습니다. 잠시만 기다려 주세요.</span>
    </div>
  )
}
