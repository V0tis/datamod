'use client'

import { useState, useEffect } from 'react'

/** Section-based skeletons for Results page. Show only when status === running (queued|analyzing). */
export function ResultsReportSkeleton({ showLongMessageAfterMs = 5000 }: { showLongMessageAfterMs?: number }) {
  const [showContextMessage, setShowContextMessage] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShowContextMessage(true), showLongMessageAfterMs)
    return () => clearTimeout(t)
  }, [showLongMessageAfterMs])

  return (
    <div className="space-y-8" aria-busy="true" aria-label="분석 중">
      {showContextMessage && (
        <p className="text-sm text-muted-foreground animate-in fade-in duration-300" role="status">
          Analyzing market signals and competitive indicators...
        </p>
      )}
      {/* Decision Summary skeleton */}
      <section className="rounded-lg border border-border/60 bg-background/50 p-4 sm:p-5" aria-hidden>
        <div className="space-y-3">
          <div className="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
          <div className="h-4 w-full rounded bg-muted/60 animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
        </div>
      </section>

      {/* Recommended Actions skeleton */}
      <section className="space-y-3" aria-hidden>
        <div className="h-4 w-40 rounded bg-muted/60 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border/60 p-3">
              <div className="flex justify-between gap-2">
                <div className="h-4 flex-1 rounded bg-muted/60 animate-pulse" />
                <div className="h-5 w-12 rounded bg-muted/40 animate-pulse shrink-0" />
              </div>
              <div className="mt-2 h-3 w-full rounded bg-muted/40 animate-pulse" />
            </div>
          ))}
        </div>
      </section>

      {/* Market Temperature skeleton */}
      <section className="rounded-lg border border-border/60 bg-background/50 p-4 sm:p-5" aria-hidden>
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="h-9 w-16 rounded bg-muted/60 animate-pulse" />
          <div className="h-4 w-12 rounded bg-muted/40 animate-pulse" />
        </div>
        <div className="mt-4 space-y-3">
          <div className="h-4 w-full rounded bg-muted/40 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-muted/40 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-muted/40 animate-pulse" />
        </div>
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="h-8 w-full rounded bg-muted/30 animate-pulse" />
        </div>
      </section>

      {/* Insights skeleton */}
      <section className="space-y-4" aria-hidden>
        {[1, 2, 3].map((i) => (
          <div key={i}>
            <div className="h-3 w-24 rounded bg-muted/60 animate-pulse mb-2" />
            <ul className="space-y-2">
              <li className="h-4 w-full rounded bg-muted/40 animate-pulse" />
              <li className="h-4 w-5/6 rounded bg-muted/40 animate-pulse" />
              <li className="h-4 w-4/5 rounded bg-muted/40 animate-pulse" />
            </ul>
          </div>
        ))}
      </section>
    </div>
  )
}
