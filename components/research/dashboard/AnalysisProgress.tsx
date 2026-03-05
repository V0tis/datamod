'use client'

import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROGRESS_STEPS = [
  { id: 'signals', label: '시장 데이터 수집 중' },
  { id: 'trends', label: '시장 트렌드 분석 중' },
  { id: 'risks', label: '리스크 요인 분석 중' },
  { id: 'strategy', label: '전략 도출 중' },
  { id: 'action', label: '실행 액션 생성 중' },
] as const

export interface AnalysisProgressProps {
  /** 0-based current step index */
  currentStep: number
  /** Optional: map streaming step IDs to step indices */
  stepMap?: Record<string, number>
  streamingStepId?: string
  className?: string
}

export const STREAM_STEP_MAP: Record<string, number> = {
  news: 0,
  pass1: 1,
  pass2: 2,
  creative: 3,
  done: 4,
}

/** Progress-based analysis loader. Only show sections after their data is available. */
export function AnalysisProgress({
  currentStep,
  stepMap = STREAM_STEP_MAP,
  streamingStepId,
  className,
}: AnalysisProgressProps) {
  const effectiveStep =
    streamingStepId && stepMap[streamingStepId] != null
      ? stepMap[streamingStepId]
      : currentStep

  return (
    <div
      className={cn(
        'rounded-xl border border-primary/30 bg-primary/5 p-6',
        className
      )}
    >
      <div className="flex items-center gap-3 mb-6">
        <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
        <h2 className="text-base font-semibold text-foreground">
          시장 분석 진행 중
        </h2>
      </div>
      <ul className="space-y-3">
        {PROGRESS_STEPS.map((step, i) => {
          const status: 'completed' | 'running' | 'pending' =
            i < effectiveStep
              ? 'completed'
              : i === effectiveStep
                ? 'running'
                : 'pending'

          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-3 transition-opacity',
                status === 'pending' && 'opacity-50'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                  status === 'completed' && 'bg-primary text-primary-foreground',
                  status === 'running' &&
                    'bg-primary/20 text-primary ring-2 ring-primary/40',
                  status === 'pending' && 'bg-muted text-muted-foreground'
                )}
              >
                {status === 'completed' && <Check className="h-3.5 w-3.5" />}
                {status === 'running' && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {status === 'pending' && (
                  <span className="text-xs font-medium" aria-hidden>○</span>
                )}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  status === 'completed' && 'text-foreground',
                  status === 'running' && 'text-primary',
                  status === 'pending' && 'text-muted-foreground'
                )}
              >
                {status === 'completed' ? '✓ ' : ''}
                {step.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
