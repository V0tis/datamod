'use client'

import { useCallback } from 'react'
import { FileDown, RefreshCw, Loader2, Bookmark } from 'lucide-react'
import { useAnalysisTasksPoll } from '@/lib/hooks/use-analysis-tasks-poll'
import { useResearchStore } from '@/lib/stores/research-store'
import { Button } from '@/components/ui/button'
import { AnalysisResultSections } from './AnalysisResultSections'
import { SectionContentSkeleton } from './SectionContentSkeleton'
import { StrategyEnginePipeline } from './dashboard/StrategyEnginePipeline'
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
  /** For inline timeline */
  polledStatus?: string | null
  hasFailure?: boolean
  displayResult?: ResearchResponse | null
}

export function PMDecisionDashboard({
  keyword,
  result,
  loading,
  streamingState,
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
  polledProgressStep,
  polledStatus,
  hasFailure = false,
  displayResult,
}: PMDecisionDashboardProps) {
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

  const analysisComplete = result != null && !isAnalyzing
  const showResultSections = (result != null || isAnalyzing || (effectiveAnalysisTasks?.length ?? 0) > 0) && Boolean(keyword?.trim())

  const timelineStep =
    polledStatus === 'running' && polledProgressStep != null
      ? Math.min(6, Math.max(0, polledProgressStep))
      : streamingState.status === 'running' || streamingState.status === 'streaming'
        ? streamingState.currentStep
        : displayResult != null && !isAnalyzing && !hasError
          ? 6
          : -1

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. 인라인 타임라인 (사용자 요청: Timeline → 리스크/기회 → 전략 → 액션 플랜) */}
      {showResultSections && (polledProgressStep != null || polledStatus || streamingState.status !== 'idle' || displayResult != null) && (
        <div id="section-timeline" className="scroll-mt-24 rounded-lg border border-border bg-card/50 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">AI 분석 타임라인</h3>
          <StrategyEnginePipeline
            keyword={keyword}
            currentStep={timelineStep}
            allCompleted={displayResult != null && !isAnalyzing && !hasError}
            streamingStepId={streamingState.status === 'running' || streamingState.status === 'streaming' ? streamingState.stepId : undefined}
            retryMessage={'retryMessage' in streamingState ? (streamingState as { retryMessage?: string }).retryMessage : undefined}
            taskData={taskData ?? {}}
            analysisTasks={effectiveAnalysisTasks ?? null}
            newsList={newsList ?? []}
            result={displayResult ?? result}
            hasError={hasError}
            errorStepIndex={errorStepIndex}
            globalErrorMessage={globalErrorMessage}
          />
        </div>
      )}

      {/* 2. 리스크 및 기회 평가 (타임라인 바로 아래) */}
      {showResultSections && (() => {
        const strategyTask = effectiveAnalysisTasks?.find((t) => t.step_name === 'strategy_generation')
        const output = (strategyTask?.output_data && typeof strategyTask.output_data === 'object'
          ? strategyTask.output_data
          : taskData?.strategy_generation) as { risks?: string[]; opportunities?: string[]; strategy_summary?: string } | undefined
        const risks = Array.isArray(output?.risks) ? output.risks.filter((s): s is string => typeof s === 'string') : []
        const opportunities = Array.isArray(output?.opportunities) ? output.opportunities.filter((s): s is string => typeof s === 'string') : []
        const summary = typeof output?.strategy_summary === 'string' ? output.strategy_summary : ''
        const hasContent = risks.length > 0 || opportunities.length > 0 || (summary?.trim().length ?? 0) > 0
        const km = result?.key_metrics
        const fallbackRisks = km?.negative_risks ?? result?.painPoints ?? []
        const fallbackOpps = km?.positive_signals ?? result?.marketNews ?? []
        return (
          <div id="section-risks-opportunities" className="scroll-mt-24 rounded-lg border border-border bg-card/50 p-4 sm:p-5 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                리스크 및 기회 평가
              </h3>
              {!isAnalyzing && (hasContent || fallbackRisks.length > 0 || fallbackOpps.length > 0) && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary shrink-0">
                  <span aria-hidden>✓</span> 완료
                </span>
              )}
            </div>
            <div className="space-y-4">
              {isAnalyzing && !hasContent && (
                <SectionContentSkeleton variant="mixed" />
              )}
              {(hasContent || fallbackRisks.length > 0 || fallbackOpps.length > 0) && (
                <>
                  {summary && <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">리스크</p>
                      <ul className="space-y-1 text-sm">
                        {(risks.length ? risks : fallbackRisks).slice(0, 5).map((r, i) => (
                          <li key={i} className="flex gap-2"><span className="text-destructive shrink-0">•</span><span>{r}</span></li>
                        ))}
                        {!risks.length && !fallbackRisks.length && !isAnalyzing && <li className="text-muted-foreground">—</li>}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">기회</p>
                      <ul className="space-y-1 text-sm">
                        {(opportunities.length ? opportunities : fallbackOpps).slice(0, 5).map((o, i) => (
                          <li key={i} className="flex gap-2"><span className="text-primary shrink-0">•</span><span>{o}</span></li>
                        ))}
                        {!opportunities.length && !fallbackOpps.length && !isAnalyzing && <li className="text-muted-foreground">—</li>}
                      </ul>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* 3. 시장 성장 분석, 경쟁 환경, 전략 제안, 실행 아이디어 (전략 → 액션 플랜 순) */}
      {showResultSections && (
        <AnalysisResultSections
          result={result}
          taskData={taskData}
          analysisTasks={effectiveAnalysisTasks ?? undefined}
          consensusData={consensusData ?? undefined}
          loading={isAnalyzing}
          keyword={keyword}
          onSaveToWorkspace={onSaveInsight}
          layout="pm-analytics"
        />
      )}

      {/* 액션 버튼 */}
      {showResultSections && (
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
      )}
    </div>
  )
}
