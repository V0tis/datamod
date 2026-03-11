'use client'

import { Loader2, Check, Circle } from 'lucide-react'
import { PROGRESS_STEPS, getProgressStepIndex } from '@/lib/analysis-activity-messages'
import { cn } from '@/lib/utils'
import type { StreamingState } from '@/lib/types/analysis-modes'

export interface AnalysisProgressBannerProps {
  keyword?: string
  streamingState: StreamingState
  /** Step ID from backend (e.g. trend_analysis, competition_analysis) */
  stepId?: string | null
  /** Pipeline step index 0–5 */
  currentStep?: number
  /** Show micro insight after delay */
  showMicroInsight?: boolean
  className?: string
}

/**
 * Progressive loading UX – shows 4 real-time steps driven by streamingState.
 * Replaces generic loading with Collecting market data → Analyzing competitors → Strategic insights → Action plan.
 */
export function AnalysisProgressBanner({
  keyword = '',
  streamingState,
  stepId,
  currentStep = 0,
  showMicroInsight = true,
  className,
}: AnalysisProgressBannerProps) {
  const isRunning =
    streamingState.status === 'running' || streamingState.status === 'streaming'
  const pipelineStep =
    isRunning && 'currentStep' in streamingState
      ? streamingState.currentStep
      : currentStep
  const effectiveStepId = isRunning && 'stepId' in streamingState ? streamingState.stepId : stepId
  const progressIndex = getProgressStepIndex(effectiveStepId ?? null, pipelineStep)
  const progressPercent = Math.min(100, ((progressIndex + 1) / PROGRESS_STEPS.length) * 100)

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
        'p-4 sm:p-5 flex flex-col gap-4 animate-in fade-in duration-300',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="AI 분석 진행 중"
    >
      <div className="flex items-start gap-3 shrink-0">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 ring-2 ring-primary/20">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">AI 분석 진행 중</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {PROGRESS_STEPS[progressIndex]?.messageKo ?? '분석을 진행하고 있습니다'}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted-foreground">진행률</span>
          <span className="font-semibold tabular-nums text-primary">
            {Math.round(progressPercent)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progressPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="분석 진행률"
          />
        </div>
      </div>

      {/* 4 progressive steps */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          분석 단계
        </p>
        <ul className="space-y-2" role="list">
          {PROGRESS_STEPS.map((step, i) => {
            const isDone = i < progressIndex
            const isActive = i === progressIndex
            return (
              <li
                key={step.id}
                className={cn(
                  'flex items-center gap-3 text-sm transition-all duration-300',
                  isDone && 'opacity-100',
                  isActive && 'opacity-100',
                  !isDone && !isActive && 'opacity-50'
                )}
              >
                {isDone ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                  </div>
                ) : isActive ? (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
                    <Circle className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                  </div>
                )}
                <span
                  className={cn(
                    'font-medium',
                    isDone && 'text-foreground',
                    isActive && 'text-foreground',
                    !isDone && !isActive && 'text-muted-foreground'
                  )}
                >
                  {step.labelKo}
                  {isActive && (
                    <span className="ml-1.5 text-primary font-normal">진행 중</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {showMicroInsight && keyword && (
        <div
          className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 animate-in fade-in duration-300"
          role="status"
        >
          <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-0.5">
            분석 대상
          </p>
          <p className="text-sm text-foreground">
            &quot;{keyword}&quot; 시장 분석을 수행하고 있습니다. 곧 인사이트가 표시됩니다.
          </p>
        </div>
      )}
    </div>
  )
}
