'use client'

import { Fragment } from 'react'
import { Check, Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getPipelineSlimStageStatuses,
  inferActivePipelineIndex,
  PIPELINE_SLIM_LABELS,
  type PipelineSlimStatusContext,
} from '@/lib/analysis/pipeline-slim-status'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export interface PipelineStepperSlimProps extends PipelineSlimStatusContext {
  keyword: string
  className?: string
  /** When set, overrides auto-inferred active step highlight */
  selectedIndex?: number | null
  onStepClick?: (index: number) => void
  /** 완료 단계의 개별 재분석 (인덱스별 API는 부모에서 매핑) */
  onRerunFromIndex?: (index: number) => void
  /** 재실행 버튼 비활성 (전역 분석 중 등) */
  rerunDisabled?: boolean
  /** 클릭 직후 해당 칩에 로딩 표시 */
  rerunPendingIndex?: number | null
}

export function PipelineStepperSlim({
  keyword,
  className,
  selectedIndex,
  onStepClick,
  onRerunFromIndex,
  rerunDisabled = false,
  rerunPendingIndex = null,
  ...ctx
}: PipelineStepperSlimProps) {
  const statuses = getPipelineSlimStageStatuses(ctx)
  const autoActive = inferActivePipelineIndex(ctx)
  const highlight = selectedIndex != null ? selectedIndex : autoActive

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          'rounded-xl border border-slate-200/70 bg-white px-2 py-2.5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60',
          className
        )}
        role="navigation"
        aria-label={`분석 파이프라인 · ${keyword}`}
      >
        <div className="border-b border-slate-100 pb-1.5 dark:border-zinc-800">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            분석 단계
          </p>
        </div>
        <div className="pt-2">
          <div className="flex w-full min-w-0 items-center gap-0 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
            {PIPELINE_SLIM_LABELS.map((label, i) => {
              const st = statuses[i] ?? 'pending'
              const isHi = highlight === i
              const pendingHere = rerunPendingIndex === i
              const showRerun = st === 'completed' && onRerunFromIndex && i !== 8 && !pendingHere
              const showLoader = st === 'running' || pendingHere
              const connectorBlue = i > 0 && statuses[i - 1] === 'completed'

              return (
                <Fragment key={label}>
                  {i > 0 ? (
                    <div
                      role="presentation"
                      className={cn(
                        'h-0 min-w-[6px] max-w-[20px] flex-1 shrink border-t border-slate-200/90 dark:border-zinc-700',
                        connectorBlue && 'border-blue-500 dark:border-blue-400'
                      )}
                      aria-hidden
                    />
                  ) : null}

                  <div
                    className={cn(
                      'group relative flex min-w-[3.25rem] max-w-[4.6rem] shrink-0 flex-col rounded-lg border text-center transition-colors',
                      onStepClick && 'cursor-default',
                      st === 'completed' &&
                        'border-slate-200/90 bg-slate-50/90 dark:border-zinc-700 dark:bg-zinc-900/50',
                      st === 'running' &&
                        cn(
                          'border border-blue-300/80 bg-white shadow-[0_0_14px_rgba(59,130,246,0.28)] dark:border-blue-500/50 dark:bg-zinc-950',
                          'animate-pulse',
                          isHi && 'ring-1 ring-blue-400/35'
                        ),
                      st === 'pending' &&
                        'border border-slate-200/80 bg-slate-50/70 dark:border-zinc-700 dark:bg-zinc-900/40',
                      st === 'failed' && 'border border-red-200 bg-red-50/90 dark:border-red-900/45 dark:bg-red-950/30'
                    )}
                  >
                    <div className="flex min-h-[3.65rem] w-full flex-row items-stretch overflow-hidden rounded-[inherit]">
                      <button
                        type="button"
                        onClick={() => onStepClick?.(i)}
                        className={cn(
                          'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center',
                          onStepClick ? 'cursor-pointer hover:bg-slate-100/90 dark:hover:bg-zinc-800/80' : 'cursor-default',
                          st === 'completed' && onStepClick && 'hover:bg-slate-100/80 dark:hover:bg-zinc-800/70',
                          st === 'running' && onStepClick && 'hover:bg-blue-50/80 dark:hover:bg-blue-950/20'
                        )}
                        aria-label={`${label} 섹션으로 이동`}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full transition-[box-shadow]',
                            st === 'running' && 'shadow-[0_0_10px_rgba(59,130,246,0.45)]'
                          )}
                          aria-hidden
                        >
                          {showLoader && (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                          )}
                          {!showLoader && st === 'completed' && (
                            <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" strokeWidth={2.5} />
                          )}
                          {!showLoader && st === 'pending' && (
                            <span className="block h-2 w-2 rounded-full bg-slate-400 dark:bg-zinc-500" />
                          )}
                          {!showLoader && st === 'failed' && (
                            <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                          )}
                        </span>
                        <span
                          className={cn(
                            'max-w-[4.5rem] truncate text-[9.5px] font-semibold leading-tight',
                            st === 'completed' && 'text-slate-800 dark:text-zinc-100',
                            (st === 'running' || pendingHere) && 'font-semibold text-blue-800 dark:text-blue-200',
                            st === 'pending' && 'font-medium text-slate-500 dark:text-zinc-400',
                            st === 'failed' && 'text-red-800 dark:text-red-200'
                          )}
                        >
                          {label}
                        </span>
                      </button>

                      {showRerun ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              className={cn(
                                'flex w-8 shrink-0 flex-col items-center justify-start border-l border-slate-200/80 px-1.5 py-2',
                                'text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-500',
                                'dark:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-blue-400',
                                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40',
                                rerunDisabled && 'cursor-not-allowed opacity-40 hover:bg-transparent'
                              )}
                              style={{ minWidth: 30 }}
                              disabled={rerunDisabled}
                              aria-label="이 단계부터 다시 분석하기"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                if (!rerunDisabled) onRerunFromIndex(i)
                              }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[220px] text-xs">
                            이 단계부터 다시 분석하기
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </div>
                </Fragment>
              )
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
