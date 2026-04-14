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
        'rounded-lg border border-slate-100 bg-slate-50/90 px-2 py-2 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/50',
        className
      )}
      role="navigation"
      aria-label={`분석 파이프라인 · ${keyword}`}
    >
      <div className="border-b border-slate-200/70 pb-2 dark:border-zinc-700/80">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">분석 단계</p>
      </div>
      <div className="border-b border-slate-200/60 pt-2 pb-1 dark:border-zinc-800">
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
                  onStepClick && 'cursor-pointer',
                  !onStepClick && 'cursor-default',
                  st === 'completed' &&
                    'border border-emerald-200/90 bg-emerald-50 dark:border-emerald-900/45 dark:bg-emerald-950/35',
                  st === 'running' &&
                    cn(
                      'border-2 border-red-500 bg-white shadow-sm dark:border-red-500 dark:bg-zinc-950',
                      isHi && 'ring-1 ring-red-500/30'
                    ),
                  st === 'pending' &&
                    'border border-slate-200/90 bg-slate-100/90 dark:border-zinc-700 dark:bg-zinc-800/55',
                  st === 'failed' && 'border border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/35',
                  st === 'completed' && onStepClick && 'hover:bg-emerald-100/80 dark:hover:bg-emerald-950/50',
                  st === 'pending' && onStepClick && 'hover:bg-slate-200/60 dark:hover:bg-zinc-800/80',
                  st === 'running' && onStepClick && 'hover:bg-red-50 dark:hover:bg-red-950/25'
                )}
              >
                <span className="flex h-5 w-5 items-center justify-center" aria-hidden>
                  {st === 'completed' && (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                  )}
                  {st === 'running' && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-red-600 dark:text-red-400" />
                  )}
                  {st === 'pending' && (
                    <span className="block h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-500" />
                  )}
                  {st === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                </span>
                <span
                  className={cn(
                    'max-w-[4.5rem] truncate text-[10px] font-semibold leading-tight',
                    st === 'completed' && 'text-emerald-800 dark:text-emerald-200',
                    st === 'running' && 'font-bold text-red-700 dark:text-red-300',
                    st === 'pending' && 'font-medium text-slate-500 dark:text-zinc-400',
                    st === 'failed' && 'text-red-800 dark:text-red-200'
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

