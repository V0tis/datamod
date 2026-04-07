'use client'

import { useRef } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResearchStore } from '@/lib/stores/research-store'

export function AnalysisActivityFeed({ className }: { className?: string }) {
  const log = useResearchStore((s) => s.streamingActivityLog)
  const analyzing = useResearchStore((s) => s.analysisStatus === 'analyzing')
  const bottomRef = useRef<HTMLDivElement>(null)

  if (log.length === 0 && !analyzing) return null

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-muted/30 overflow-hidden',
        className
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-muted/40">
        {analyzing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" aria-hidden />
        ) : (
          <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          분석 활동
        </span>
      </div>
      <ul
        className="max-h-40 overflow-y-auto px-3 py-2 space-y-1.5 text-xs text-foreground/90"
        aria-live="polite"
        aria-relevant="additions"
      >
        {log.length === 0 && analyzing ? (
          <li className="text-muted-foreground">준비 중…</li>
        ) : (
          log.map((row, i) => (
            <li key={`${row.ts}-${i}`} className="flex gap-2">
              <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 pt-0.5">
                {new Date(row.ts).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
              <span className="leading-snug">{row.message}</span>
            </li>
          ))
        )}
        <div ref={bottomRef} />
      </ul>
    </div>
  )
}
