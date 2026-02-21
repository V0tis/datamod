'use client'

import { cn } from '@/lib/utils'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import {
  type AnalysisMode,
  type StreamingState,
  ANALYSIS_MODE_STEPS,
} from '@/lib/types/analysis-modes'

export interface StepProgressTrackerProps {
  mode: AnalysisMode
  streamingState: StreamingState
  className?: string
  variant?: 'horizontal' | 'vertical' | 'compact'
}

export function StepProgressTracker({
  mode,
  streamingState,
  className,
  variant = 'horizontal',
}: StepProgressTrackerProps) {
  const steps = ANALYSIS_MODE_STEPS[mode]
  const { status } = streamingState
  const currentStep =
    status === 'running' || status === 'streaming'
      ? streamingState.currentStep
      : status === 'completed'
        ? steps.length
        : status === 'error'
          ? streamingState.lastSuccessfulStep ?? -1
          : -1

  const getStepStatus = (index: number): 'pending' | 'running' | 'completed' | 'error' => {
    if (status === 'idle') return 'pending'
    if (status === 'completed') return 'completed'
    if (status === 'error') {
      const lastSuccess = streamingState.lastSuccessfulStep ?? -1
      if (index < lastSuccess) return 'completed'
      if (index === lastSuccess + 1) return 'error'
      return 'pending'
    }
    if (index < currentStep) return 'completed'
    if (index === currentStep) return 'running'
    return 'pending'
  }

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {steps.map((step, i) => {
          const stepStatus = getStepStatus(i)
          return (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-1.5',
                stepStatus === 'completed' && 'text-primary',
                stepStatus === 'running' && 'text-primary',
                stepStatus === 'pending' && 'text-muted-foreground',
                stepStatus === 'error' && 'text-destructive'
              )}
            >
              {stepStatus === 'completed' && <Check className="h-3.5 w-3.5" />}
              {stepStatus === 'running' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {stepStatus === 'error' && <AlertCircle className="h-3.5 w-3.5" />}
              {stepStatus === 'pending' && (
                <div className="h-2 w-2 rounded-full bg-muted" />
              )}
              <span className="text-xs font-medium">{step.description}</span>
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'h-px w-4',
                    stepStatus === 'completed' ? 'bg-primary' : 'bg-border'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-0', className)}>
        {steps.map((step, i) => {
          const stepStatus = getStepStatus(i)
          const isLast = i === steps.length - 1
          return (
            <div key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    stepStatus === 'completed' && 'border-primary bg-primary text-primary-foreground',
                    stepStatus === 'running' && 'border-primary bg-primary/10 text-primary',
                    stepStatus === 'pending' && 'border-border bg-muted text-muted-foreground',
                    stepStatus === 'error' && 'border-destructive bg-destructive/10 text-destructive'
                  )}
                >
                  {stepStatus === 'completed' && <Check className="h-4 w-4" />}
                  {stepStatus === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
                  {stepStatus === 'error' && <AlertCircle className="h-4 w-4" />}
                  {stepStatus === 'pending' && (
                    <span className="text-xs font-medium">{i + 1}</span>
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[24px] transition-colors',
                      stepStatus === 'completed' ? 'bg-primary' : 'bg-border'
                    )}
                  />
                )}
              </div>
              <div className="pb-6">
                <p
                  className={cn(
                    'text-sm font-medium',
                    stepStatus === 'completed' && 'text-foreground',
                    stepStatus === 'running' && 'text-primary',
                    stepStatus === 'pending' && 'text-muted-foreground',
                    stepStatus === 'error' && 'text-destructive'
                  )}
                >
                  {step.description}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center', className)}>
      {steps.map((step, i) => {
        const stepStatus = getStepStatus(i)
        const isLast = i === steps.length - 1
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                  stepStatus === 'completed' && 'border-primary bg-primary text-primary-foreground',
                  stepStatus === 'running' && 'border-primary bg-primary/10 text-primary ring-4 ring-primary/20',
                  stepStatus === 'pending' && 'border-border bg-card text-muted-foreground',
                  stepStatus === 'error' && 'border-destructive bg-destructive/10 text-destructive'
                )}
              >
                {stepStatus === 'completed' && <Check className="h-5 w-5" />}
                {stepStatus === 'running' && <Loader2 className="h-5 w-5 animate-spin" />}
                {stepStatus === 'error' && <AlertCircle className="h-5 w-5" />}
                {stepStatus === 'pending' && (
                  <span className="text-sm font-semibold">{i + 1}</span>
                )}
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    'text-xs font-medium',
                    stepStatus === 'completed' && 'text-foreground',
                    stepStatus === 'running' && 'text-primary',
                    stepStatus === 'pending' && 'text-muted-foreground',
                    stepStatus === 'error' && 'text-destructive'
                  )}
                >
                  {step.description}
                </p>
              </div>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mx-2 transition-colors',
                  stepStatus === 'completed' ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

interface ProgressBannerProps {
  mode: AnalysisMode
  streamingState: StreamingState
  onAbort?: () => void
  className?: string
}

export function ProgressBanner({
  mode,
  streamingState,
  onAbort,
  className,
}: ProgressBannerProps) {
  const { status } = streamingState
  const steps = ANALYSIS_MODE_STEPS[mode]
  const currentStep =
    status === 'running' || status === 'streaming' ? streamingState.currentStep : 0
  const currentStepInfo = steps[currentStep]
  const progress =
    status === 'running' || status === 'streaming'
      ? Math.round(((currentStep + 1) / steps.length) * 100)
      : status === 'completed'
        ? 100
        : 0

  if (status === 'idle' || status === 'completed') return null

  if (status === 'error') {
    return (
      <div
        className={cn(
          'rounded-lg border border-destructive/30 bg-destructive/5 p-4',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">분석 중 오류 발생</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {streamingState.message}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-primary/30 bg-primary/5 p-4',
        className
      )}
    >
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {currentStepInfo?.description ?? '분석 중'}
            </p>
            <p className="text-xs text-muted-foreground">
              단계 {currentStep + 1} / {steps.length}
            </p>
          </div>
        </div>
        {onAbort && (
          <button
            type="button"
            onClick={onAbort}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            중단
          </button>
        )}
      </div>

      <StepProgressTracker
        mode={mode}
        streamingState={streamingState}
        variant="compact"
        className="mb-3"
      />

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>진행률</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
