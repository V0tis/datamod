'use client'

import { useCallback } from 'react'
import { FileDown, RefreshCw, Loader2, Bookmark } from 'lucide-react'
import { useAnalysisTasksPoll } from '@/lib/hooks/use-analysis-tasks-poll'
import { useResearchStore } from '@/lib/stores/research-store'
import { Button } from '@/components/ui/button'
import { StrategyEnginePipeline } from './dashboard/StrategyEnginePipeline'
import { AnalysisResultSections } from './AnalysisResultSections'
import type { ResearchResponse } from '@/lib/stores/research-store'
import type { StreamingState } from '@/lib/types/analysis-modes'

export interface PMDecisionDashboardProps {
  keyword: string
  result: ResearchResponse | null
  loading: boolean
  streamingState: StreamingState
  /** Consensus / strategic summary for Target users & Value proposition */
  consensusData?: {
    strategicSummary?: {
      summary?: string
      opportunity?: string
      threat?: string
      actionItems?: string[]
    }
  } | null
  /** 폴링에서 받은 진행 단계 (0-based). 스트리밍 없이 새 탭/새로고침 시 사용 */
  polledProgressStep?: number
  /** 시장 데이터 수집 결과 (타임라인 Step 1용) */
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  /** Per-task partial data from backend (AI Analysis Console) */
  taskData?: Partial<Record<string, unknown>>
  /** Polled task status from backend (optional, falls back to taskData) */
  analysisTasks?: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    output_data: unknown
    error_message: string | null
  }> | null
  onPrint?: () => void
  onSaveInsight?: () => void
  onReanalyze?: () => void
  onAbort?: () => void
  reanalyzing?: boolean
  /** When analysis failed globally; timeline stays visible with error step */
  hasError?: boolean
  /** Step index (0-4) where error occurred */
  errorStepIndex?: number
  /** Global error message to show in failed step */
  globalErrorMessage?: string
}

export function PMDecisionDashboard({
  keyword,
  result,
  loading,
  streamingState,
  polledProgressStep,
  newsList = [],
  taskData = {},
  analysisTasks: analysisTasksProp,
  onPrint,
  onSaveInsight,
  onReanalyze,
  reanalyzing = false,
  consensusData,
  hasError = false,
  errorStepIndex = 0,
  globalErrorMessage,
}: PMDecisionDashboardProps) {
  const currentStep =
    polledProgressStep != null && loading
      ? polledProgressStep
      : streamingState.status === 'running' || streamingState.status === 'streaming'
        ? streamingState.currentStep
        : streamingState.status === 'completed'
          ? 4
          : -1
  const stepId =
    streamingState.status === 'running' || streamingState.status === 'streaming'
      ? streamingState.stepId
      : undefined
  const retryMessage =
    streamingState.status === 'running' || streamingState.status === 'streaming'
      ? ('retryMessage' in streamingState ? streamingState.retryMessage : undefined)
      : undefined

  const isAnalyzing =
    loading ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming'

  const analysisId = useResearchStore((s) => s.analysisId)
  const analysisTasks = useResearchStore((s) => s.analysisTasks)
  const setAnalysisTasks = useResearchStore((s) => s.setAnalysisTasks)

  const onTasks = useCallback(
    (data: { tasks: typeof analysisTasks }) => {
      setAnalysisTasks(data.tasks)
    },
    [setAnalysisTasks]
  )

  useAnalysisTasksPoll(analysisId, isAnalyzing, onTasks)

  const effectiveAnalysisTasks = analysisTasks ?? analysisTasksProp

  const showTimeline = (result != null || isAnalyzing || hasError) && Boolean(keyword?.trim())
  const analysisComplete = result != null && !isAnalyzing
  const showResultSections = (result != null || isAnalyzing || (effectiveAnalysisTasks?.length ?? 0) > 0) && Boolean(keyword?.trim())

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* AI Analysis Timeline - primary focus, shows pending/running/completed */}
      {showTimeline && (
        <StrategyEnginePipeline
          keyword={keyword}
          currentStep={currentStep}
          allCompleted={
            streamingState.status === 'completed' || (result != null && !isAnalyzing && !hasError)
          }
          streamingStepId={stepId}
          retryMessage={retryMessage}
          taskData={taskData}
          analysisTasks={effectiveAnalysisTasks}
          newsList={newsList}
          result={result}
          onRetryStep={onReanalyze}
          hasError={hasError}
          errorStepIndex={errorStepIndex}
          globalErrorMessage={globalErrorMessage}
        />
      )}

      {/* Strategy, Strategic Actions, Action Plan - show progressively during streaming */}
      {showResultSections && (
        <>
          <AnalysisResultSections
            result={result}
            taskData={taskData}
            analysisTasks={effectiveAnalysisTasks ?? undefined}
            consensusData={consensusData ?? undefined}
            loading={isAnalyzing}
            keyword={keyword}
            onSaveToWorkspace={onSaveInsight}
          />

          <div className="flex flex-wrap gap-2 pt-4 border-t border-border/60">
        {onPrint && (
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        )}
        {onSaveInsight && (
          <Button variant="outline" size="sm" onClick={onSaveInsight} className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            인사이트로 저장
          </Button>
        )}
        {onReanalyze && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="gap-2"
          >
            {reanalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                재분석 중...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                다시 분석하기
              </>
            )}
          </Button>
        )}
          </div>
        </>
      )}
    </div>
  )
}
