'use client'

import { StrategyEnginePipeline } from './dashboard/StrategyEnginePipeline'
import type { ResearchResponse } from '@/lib/stores/research-store'
import type { StreamingState } from '@/lib/types/analysis-modes'

export interface ResultTimelineSectionProps {
  keyword: string
  streamingState: StreamingState
  polledProgressStep?: number
  polledStatus?: string | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    output_data: unknown
    error_message: string | null
  }> | null
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  result?: ResearchResponse | null
  displayResult?: ResearchResponse | null
  hasError?: boolean
  errorStepIndex?: number
  globalErrorMessage?: string
  loading?: boolean
  onRetryStep?: () => void
  /** Max height + scroll for compact view */
  maxHeight?: string
  className?: string
}

/**
 * AI 분석 타임라인 – 진행 단계 표시.
 * 상단 배치 시 maxHeight로 스크롤 가능.
 */
export function ResultTimelineSection({
  keyword,
  streamingState,
  polledProgressStep,
  polledStatus,
  taskData = {},
  analysisTasks = null,
  newsList = [],
  result,
  displayResult,
  hasError = false,
  errorStepIndex = 0,
  globalErrorMessage,
  loading = false,
  onRetryStep,
  maxHeight = '320px',
  className,
}: ResultTimelineSectionProps) {
  const timelineStep =
    polledStatus === 'running' && polledProgressStep != null
      ? Math.min(6, Math.max(0, polledProgressStep))
      : streamingState.status === 'running' || streamingState.status === 'streaming'
        ? streamingState.currentStep
        : displayResult != null && !loading && !hasError
          ? 6
          : -1

  const show = polledProgressStep != null || polledStatus || streamingState.status !== 'idle' || displayResult != null
  if (!show) return null

  return (
    <div
      id="section-timeline"
      className={className}
      style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}
    >
      <div className="rounded-lg border border-border bg-card/50 p-4 sm:p-5 scroll-mt-24">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">AI 분석 타임라인</h3>
        <StrategyEnginePipeline
          keyword={keyword}
          currentStep={timelineStep}
          allCompleted={displayResult != null && !loading && !hasError}
          streamingStepId={streamingState.status === 'running' || streamingState.status === 'streaming' ? streamingState.stepId : undefined}
          retryMessage={'retryMessage' in streamingState ? (streamingState as { retryMessage?: string }).retryMessage : undefined}
          taskData={taskData}
          analysisTasks={analysisTasks}
          newsList={newsList}
          result={displayResult ?? result ?? null}
          hasError={hasError}
          errorStepIndex={errorStepIndex}
          globalErrorMessage={globalErrorMessage}
          onRetryStep={onRetryStep}
        />
      </div>
    </div>
  )
}
