'use client'

import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getPipelineSlimStageStatuses,
  inferActivePipelineIndex,
  PIPELINE_SLIM_LABELS,
  type PipelineSlimStatusContext,
} from '@/lib/analysis/pipeline-slim-status'

export interface PipelineStepperSlimProps extends PipelineSlimStatusContext {
  keyword: string
  className?: string
  /** When set, overrides auto-inferred active step highlight */
  selectedIndex?: number | null
  onStepClick?: (index: number) => void
}

export function PipelineStepperSlim({
  keyword,
  className,
  selectedIndex,
  onStepClick,
  ...ctx
}: PipelineStepperSlimProps) {
  const statuses = getPipelineSlimStageStatuses(ctx)
  const autoActive = inferActivePipelineIndex(ctx)
  const highlight = selectedIndex != null ? selectedIndex : autoActive

  return (
    <div
      className={cn(
        'rounded-lg border border-slate-200/90 bg-slate-50/80 px-2 py-2 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/50',
        className
      )}
      role="navigation"
      aria-label={`분석 파이프라인 · ${keyword}`}
    >
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        분석 단계
      </p>
      <div className="flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
        {PIPELINE_SLIM_LABELS.map((label, i) => {
          const st = statuses[i] ?? 'pending'
          const isHi = highlight === i
          return (
            <button
              key={label}
              type="button"
              onClick={() => onStepClick?.(i)}
              className={cn(
                'flex min-w-[3.25rem] shrink-0 flex-col items-center gap-1 rounded-lg border px-2 py-1.5 text-center transition-colors',
                onStepClick && 'cursor-pointer hover:bg-white/90 dark:hover:bg-zinc-900/90',
                !onStepClick && 'cursor-default',
                isHi && 'border-primary/50 bg-primary/10 ring-1 ring-primary/20',
                !isHi && 'border-transparent bg-white/60 dark:bg-zinc-900/40',
                st === 'failed' && 'border-red-300/80 bg-red-50/90 dark:border-red-900/50 dark:bg-red-950/40'
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
                {st === 'completed' && (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                )}
                {st === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                {st === 'pending' && (
                  <span className="block h-2 w-2 rounded-full bg-slate-300 dark:bg-zinc-600" />
                )}
                {st === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
              </span>
              <span
                className={cn(
                  'max-w-[4.5rem] truncate text-[10px] font-semibold leading-tight',
                  st === 'running' && 'text-foreground',
                  st === 'completed' && 'text-slate-600 dark:text-zinc-400',
                  st === 'pending' && 'text-muted-foreground',
                  st === 'failed' && 'text-red-700 dark:text-red-300'
                )}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
