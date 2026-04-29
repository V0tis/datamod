'use client'

import { useCallback } from 'react'
import { useAnalysisTasksPoll, type AnalysisTasksResponse } from '@/hooks/use-analysis-tasks-poll'
import { useResearchStore } from '@/lib/stores/research-store'
import { AnalysisResultSections } from './AnalysisResultSections'
import { ProductStrategyResult } from './ProductStrategyResult'
import { SectionContentSkeleton } from './SectionContentSkeleton'
import { StrategyEnginePipeline } from './dashboard/StrategyEnginePipeline'
import { RiskSignalsSeverityList } from '@/components/research/RiskSignalsSeverityList'
import { ConclusionActionStrip } from '@/components/research/ConclusionActionStrip'
import { StrategyEvaluationSection } from '@/components/research/StrategyEvaluationSection'
import { normalizeRiskSignalsFromParse } from '@/lib/ai/pipeline-prompts'
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
  /** When true, timeline is rendered by parent at top; omit here */
  hideTimeline?: boolean
}

/** 폴링이 DB 반영 지연으로 pending을 주면, 스트리밍에서 이미 completed로 본 단계를 덮어쓰지 않음 */
function mergeAnalysisTasksPreferProgress(
  prev: PMDecisionDashboardProps['analysisTasks'] | null | undefined,
  incoming: NonNullable<AnalysisTasksResponse['tasks']>
): NonNullable<AnalysisTasksResponse['tasks']> {
  if (!prev?.length) return incoming
  const rank = (s: string) => (s === 'completed' ? 4 : s === 'failed' ? 3 : s === 'running' ? 2 : 1)
  const byName = new Map(prev.map((t) => [t.step_name, t]))
  return incoming.map((inc) => {
    const p = byName.get(inc.step_name)
    if (!p) return inc
    if (rank(p.status) > rank(inc.status)) return { ...inc, ...p, status: p.status }
    return inc
  })
}

export function PMDecisionDashboard({
  keyword,
  result,
  loading,
  streamingState,
  newsList = [],
  taskData = {},
  analysisTasks: analysisTasksProp,
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
  hideTimeline = false,
}: PMDecisionDashboardProps) {
  const isAnalyzing =
    loading ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming'

  const analysisId = useResearchStore((s) => s.analysisId)
  const analysisTasks = useResearchStore((s) => s.analysisTasks)
  const setAnalysisTasks = useResearchStore((s) => s.setAnalysisTasks)

  const onTasks = useCallback(
    (data: AnalysisTasksResponse) => {
      if (data.fetch_error) return
      const prev = useResearchStore.getState().analysisTasks
      setAnalysisTasks(mergeAnalysisTasksPreferProgress(prev, data.tasks))
    },
    [setAnalysisTasks]
  )

  useAnalysisTasksPoll(analysisId, isAnalyzing, onTasks)

  const effectiveAnalysisTasks = analysisTasks ?? analysisTasksProp

  const analysisComplete = result != null && !isAnalyzing
  const showResultSections = (result != null || isAnalyzing || (effectiveAnalysisTasks?.length ?? 0) > 0) && Boolean(keyword?.trim())

  const streamDone = streamingState.status === 'completed' && !hasError
  const timelineStep =
    polledStatus === 'running' && polledProgressStep != null
      ? Math.min(8, Math.max(0, polledProgressStep))
      : streamingState.status === 'running' || streamingState.status === 'streaming'
        ? streamingState.currentStep
        : streamDone || (displayResult != null && !isAnalyzing && !hasError)
          ? 8
          : -1

  return (
    <div className="space-y-8 animate-in fade-in duration-300 font-[family-name:var(--font-sans)]">
      {/* 0. 분석 완료 후 최우선: 3줄 요약 액션 */}
      {analysisComplete && (displayResult ?? result) && (
        <ConclusionActionStrip
          result={displayResult ?? result}
          taskData={taskData}
          analysisTasks={effectiveAnalysisTasks}
          className="rounded-[12px] border border-zinc-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]  "
        />
      )}

      {/* 1. 타임라인 (hideTimeline이면 상단에서 렌더링) */}
      {!hideTimeline && showResultSections && (polledProgressStep != null || polledStatus || streamingState.status !== 'idle' || displayResult != null || streamDone) && (
        <div
          id="section-timeline"
          className="scroll-mt-24 rounded-[12px] border border-zinc-200/90 bg-zinc-50/50 p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)]  "
        >
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500  mb-1">
            AI 분석 파이프라인
          </h2>
          <p className="text-lg font-semibold tracking-tight text-zinc-900  mb-5">실시간 9단계 진행</p>
          <StrategyEnginePipeline
            keyword={keyword}
            currentStep={timelineStep}
            allCompleted={!hasError && (streamDone || (displayResult != null && !isAnalyzing))}
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
        const insightTask = effectiveAnalysisTasks?.find((t) => t.step_name === 'insight_extraction')
        const insightRaw =
          insightTask?.output_data && typeof insightTask.output_data === 'object'
            ? (insightTask.output_data as { risk_signals?: unknown[] })
            : (taskData?.insight_extraction as { risk_signals?: unknown[] } | undefined)
        const riskSignalItems = normalizeRiskSignalsFromParse(
          Array.isArray(insightRaw?.risk_signals)
            ? insightRaw.risk_signals
            : Array.isArray(km?.risk_signals)
              ? km.risk_signals
              : []
        )
        const fallbackRisks = km?.negative_risks ?? result?.painPoints ?? []
        const fallbackOpps = km?.positive_signals ?? result?.marketNews ?? []
        const showRiskBlock =
          hasContent ||
          fallbackRisks.length > 0 ||
          fallbackOpps.length > 0 ||
          riskSignalItems.length > 0
        return (
          <div
            id="section-risks-opportunities"
            className="scroll-mt-24 rounded-[12px] border border-zinc-200/90 bg-white p-4 sm:p-6 shadow-[0_1px_3px_rgba(15,23,42,0.06)] animate-in fade-in duration-300  "
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500 ">
                리스크 및 기회 평가
              </h2>
              {!isAnalyzing && showRiskBlock && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-primary shrink-0">
                  <span aria-hidden>✓</span> 완료
                </span>
              )}
            </div>
            <div className="space-y-4">
              {result && !isAnalyzing && (
                <div className="rounded-[12px] border border-zinc-100 bg-zinc-50/80 p-4  ">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-zinc-500  mb-2">
                    AI PM의 한 줄 평
                  </p>
                  <p className="text-sm font-medium leading-relaxed text-zinc-800 ">
                    {summary?.trim() ||
                      (riskSignalItems.length > 0
                        ? `리스크 신호 ${riskSignalItems.length}건을 기준으로 완화 우선순위를 정하면 실행 리스크를 줄일 수 있습니다.`
                        : '전략 단계 요약과 아래 매트릭스를 함께 읽으면 기회 대비 실행 난이도가 한눈에 드러납니다.')}
                  </p>
                </div>
              )}
              {result && !isAnalyzing && (
                <StrategyEvaluationSection result={result} loading={false} embedded />
              )}
              {isAnalyzing && !showRiskBlock && (
                <SectionContentSkeleton variant="mixed" />
              )}
              {showRiskBlock && (
                <>
                  {summary && <p className="text-sm text-muted-foreground leading-relaxed">{summary}</p>}
                  {riskSignalItems.length > 0 ? (
                    <div className="rounded-xl border border-border/60 bg-muted/5 p-3 sm:p-4">
                      <RiskSignalsSeverityList items={riskSignalItems} maxItems={6} />
                    </div>
                  ) : null}
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

      {/* 3. Product Strategy Result: 5-part structure (Market Summary, Key Insights, Opportunity Areas, Strategy, PM Action Plan) */}
      {showResultSections && (
        <ProductStrategyResult
          result={displayResult ?? result}
          taskData={taskData}
          loading={isAnalyzing}
          keyword={keyword}
        />
      )}

      {/* 4. 시장 성장 분석, 경쟁 환경, 전략 제안 (상세 리포트) */}
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

    </div>
  )
}
