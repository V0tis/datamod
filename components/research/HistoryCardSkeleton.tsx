'use client'

import { cn } from '@/lib/utils'

/** Single card skeleton for History list. */
function HistoryCardSkeletonItem() {
  return (
    <div className="rounded-xl border border-border/60 bg-card py-4 px-4 sm:px-5 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-5 w-32 rounded bg-muted/60" />
            <div className="h-4 w-14 rounded bg-muted/50" />
          </div>
          <div className="h-3 w-20 rounded bg-muted/40" />
          <div className="h-4 w-full max-w-md rounded bg-muted/40" />
          <div className="h-3 w-3/4 rounded bg-muted/30" />
        </div>
        <div className="flex shrink-0 gap-1">
          <div className="h-4 w-12 rounded bg-muted/40" />
          <div className="h-8 w-8 rounded bg-muted/40" />
        </div>
      </div>
    </div>
  )
}

/** List of card skeletons for History page. No full-page loader. */
export function HistoryCardSkeletonList({ count = 5, grid }: { count?: number; grid?: boolean }) {
  return (
    <ul
      className={cn(
        'list-none p-0 m-0',
        grid ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-1'
      )}
      aria-busy="true"
      aria-label="목록 불러오는 중"
    >
      {Array.from({ length: count }, (_, i) => (
        <li key={i}>
          <HistoryCardSkeletonItem />
        </li>
      ))}
    </ul>
  )
}
