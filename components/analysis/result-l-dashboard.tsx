'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { analysisPageBg } from '@/components/analysis/analysis-card'
import { OpportunityScoreGauge } from '@/components/analysis/opportunity-score-gauge'
import { UrgentTaskCards } from '@/components/analysis/urgent-task-cards'
import { StrategyExecutionTable } from '@/components/analysis/strategy-execution-table'
import { AnalysisSourceButton } from '@/components/analysis/analysis-source-button'
import type { ResultPageStructuredSectionsProps } from '@/components/research/ResultPageStructuredSections'
import { OpportunityScoreBreakdown } from '@/components/research/OpportunityScoreBreakdown'
import { ResultSummaryCards } from '@/components/research/ResultSummaryCards'
import { StrategicDecisionLayer } from '@/components/research/StrategicDecisionLayer'
import { StrategyEvaluationSection } from '@/components/research/StrategyEvaluationSection'
import { AnalysisResultSections } from '@/components/research/AnalysisResultSections'
import { KeyMarketInsightsCard } from '@/components/research/KeyMarketInsightsCard'
import { StrategyFrameworkPanel } from '@/components/research/StrategyFrameworkPanel'
import { ConclusionActionStrip } from '@/components/research/ConclusionActionStrip'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { MotionReveal } from '@/components/common/MotionReveal'
import { useResearchStore } from '@/lib/stores/research-store'
import { toast } from 'sonner'
import { PipelineTimeline } from '@/components/analysis/PipelineTimeline'
import { taskIdToResearchRunOptions } from '@/lib/analysis/pipeline-task-retry'
import { buildPipelineTimelineStages, uiStageIdToRetryTaskId } from '@/lib/analysis/build-pipeline-timeline-stages'
import { createIdleState, type StreamingState } from '@/lib/types/analysis-modes'
import { scrollToReportSection } from '@/components/analysis/report-scroll-toc'
import { ReportSectionTabBar } from '@/components/analysis/report-section-tab-bar'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { ConclusionStructuredBlocks } from '@/components/research/ConclusionStructuredBlocks'
import { stripLeadingMarkdownHeadings } from '@/lib/strip-markdown-heading-markers'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { AnalysisMetaRow, SummaryStatPills, TopPmActionsStrip } from '@/components/analysis/analysis-summary-header'

function isStepComplete(
  tasks: Array<{ step_name: string; status: string }> | null | undefined,
  step: string
) {
  return tasks?.some((t) => t.step_name === step && t.status === 'completed') ?? false
}

type ResultLDashboardProps = ResultPageStructuredSectionsProps & {
  countryCode?: string
  aiPrimaryModel?: 'gemini' | 'groq'
  phaseRerunDisabled?: boolean
  streamingState?: StreamingState
  polledProgressStep?: number
  polledStatus?: string | null
  pipelineHasError?: boolean
  pipelineErrorStepIndex?: number
  pipelineLoading?: boolean
  /** 타임라인 실패 시 백엔드/스트림 메시지 */
  pipelineGlobalErrorMessage?: string | null
}

/** 스크롤 앵커 오프셋은 부모 `--report-anchor-offset`(파이프라인+탭 높이)로 결정 */
const sectionScrollClass = 'scroll-mt-[var(--report-anchor-offset)]'

/**
 * L자형 분석 대시보드: 슬림 파이프라인, 스티키 목차, 좌측 요약 레일, 단일 스크롤 통합 리포트.
 */
export function ResultLDashboard({
  result,
  displayResult,
  taskData = {},
  analysisTasks = null,
  consensusData,
  newsList = [],
  loading = false,
  keyword = '',
  analysisFailed = false,
  countryCode = 'KR',
  aiPrimaryModel,
  phaseRerunDisabled = false,
  streamingState: streamingStateProp,
  polledProgressStep,
  polledStatus = null,
  pipelineHasError = false,
  pipelineErrorStepIndex = 0,
  pipelineLoading = false,
  pipelineGlobalErrorMessage = null,
}: ResultLDashboardProps) {
  const streamingState = streamingStateProp ?? createIdleState()
  const effectiveResult = displayResult ?? result
  const hasResultData = !!(effectiveResult?.reportId ?? effectiveResult?.key_metrics)
  const hasPipelineContext =
    (analysisTasks?.length ?? 0) > 0 ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming' ||
    streamingState.status === 'completed'

  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const analysisBusy = useResearchStore((s) => s.isAnalyzingNow())

  const handleRetryPipelineStep = useCallback(
    (failedTaskId?: string) => {
      const k = keyword.trim()
      if (!k) {
        toast.error('키워드가 없습니다.')
        return
      }
      if (phaseRerunDisabled || analysisBusy) {
        toast.warning('다른 분석이 끝난 뒤 재시도할 수 있습니다.')
        return
      }
      const opts = taskIdToResearchRunOptions(failedTaskId)
      if (opts == null) {
        toast.error('이 단계는 자동 재시도를 지원하지 않거나, 단계 정보가 없습니다.')
        return
      }
      void startStreamingResearch(k, {
        country_code: countryCode,
        ai_primary_model: aiPrimaryModel,
        ...opts,
      }).catch(() => {})
    },
    [keyword, phaseRerunDisabled, analysisBusy, startStreamingResearch, countryCode, aiPrimaryModel]
  )

  const reportId = effectiveResult?.reportId ?? null
  const sectionKeyPrefix = reportId ?? 'pending'
  const liveOpp = effectiveResult?.key_metrics?.opportunity_score
  const liveOppNum =
    typeof liveOpp === 'number' && Number.isFinite(liveOpp) ? liveOpp : null
  const lastStableOppRef = useRef<number | null>(null)

  useEffect(() => {
    lastStableOppRef.current = null
  }, [reportId])

  useEffect(() => {
    if (liveOppNum != null) lastStableOppRef.current = liveOppNum
  }, [liveOppNum])

  const stableOppScore =
    liveOppNum ?? (analysisFailed ? lastStableOppRef.current : null)

  const streamDone = streamingState.status === 'completed' && !pipelineHasError
  const streamingLive =
    streamingState.status === 'running' || streamingState.status === 'streaming' ? streamingState : null
  const streamingStepIdLive = streamingLive?.stepId
  const streamingCurrentStepLive = streamingLive?.currentStep

  const pipelineInFlight =
    !!pipelineLoading ||
    analysisBusy ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming' ||
    polledStatus === 'running'

  const analysisTasksForPipeline = useMemo(() => {
    if (!analysisTasks?.length) return null
    return analysisTasks.map((t) => {
      const st = t.status as 'pending' | 'running' | 'completed' | 'failed'
      const err =
        t && typeof t === 'object' && 'error_message' in t && (t as { error_message?: unknown }).error_message != null
          ? String((t as { error_message?: unknown }).error_message)
          : null
      const started_at =
        t && typeof t === 'object' && 'started_at' in t ? ((t as { started_at?: string | null }).started_at ?? null) : null
      const completed_at =
        t && typeof t === 'object' && 'completed_at' in t
          ? ((t as { completed_at?: string | null }).completed_at ?? null)
          : null
      return {
        step_name: t.step_name,
        status: st,
        output_data: t.output_data,
        error_message: err,
        started_at,
        completed_at,
      }
    })
  }, [analysisTasks])

  const timelineStep = useMemo(() => {
    if (polledStatus === 'running' && polledProgressStep != null) {
      return Math.min(8, Math.max(0, polledProgressStep))
    }
    if (streamingLive) {
      return streamingCurrentStepLive ?? -1
    }
    if (
      streamDone ||
      (displayResult != null && !pipelineLoading && !pipelineHasError)
    ) {
      return 7
    }
    return -1
  }, [
    polledStatus,
    polledProgressStep,
    streamingLive,
    streamingCurrentStepLive,
    streamDone,
    displayResult,
    pipelineLoading,
    pipelineHasError,
  ])

  const allCompleted = useMemo(
    () =>
      !pipelineHasError &&
      (streamDone || (displayResult != null && !pipelineLoading)),
    [pipelineHasError, streamDone, displayResult, pipelineLoading]
  )

  const showPipeline =
    polledProgressStep != null ||
    !!polledStatus ||
    streamingState.status !== 'idle' ||
    displayResult != null ||
    streamDone ||
    pipelineLoading

  const pipelineServedFromServerCache = useResearchStore((s) => s.pipelineServedFromServerCache ?? false)

  const pipelineTimelineStages = useMemo(
    () =>
      buildPipelineTimelineStages({
        analysisTasks: analysisTasksForPipeline,
        taskData,
        streamingStepId: streamingStepIdLive,
        currentStep: timelineStep,
        allCompleted,
        pipelineInFlight,
        hasError: pipelineHasError,
        errorStepIndex: pipelineErrorStepIndex,
        result: effectiveResult ?? null,
        pipelineServedFromServerCache,
        globalErrorMessage: pipelineGlobalErrorMessage,
      }),
    [
      analysisTasksForPipeline,
      taskData,
      streamingStepIdLive,
      timelineStep,
      allCompleted,
      pipelineInFlight,
      pipelineHasError,
      pipelineErrorStepIndex,
      effectiveResult,
      pipelineServedFromServerCache,
      pipelineGlobalErrorMessage,
    ]
  )

  const km = effectiveResult?.key_metrics
  const scoreSummaryLeft =
    sanitizeForKoreanDisplay(km?.opportunity_score_summary_text ?? km?.opportunity_score_reasoning)?.trim() || null
  const scoreReasonRight =
    sanitizeForKoreanDisplay(
      km?.opportunity_score_reason_text ?? km?.strategic_decision_layer?.market_opportunity_explanation
    )?.trim() || null
  /** 상단 액션 카드와 중복되지 않게: 근거·배경 전용(없으면 기존 summary_insights) */
  const conclusionFull = stripLeadingMarkdownHeadings(
    sanitizeForKoreanDisplay(km?.background_rationale)?.trim() ||
      sanitizeForKoreanDisplay(km?.summary_insights)?.trim() ||
      '핵심 전략 방향을 분석 완료 후 확인할 수 있습니다.'
  )

  const highlightTerms = useMemo(() => {
    const list: string[] = []
    if (keyword.trim()) list.push(keyword.trim())
    const sigs = km?.positive_signals
    if (Array.isArray(sigs)) {
      for (const s of sigs.slice(0, 6)) {
        if (typeof s === 'string' && s.length > 2 && s.length < 56) list.push(s.trim())
      }
    }
    return [...new Set(list)].slice(0, 12)
  }, [keyword, km])

  const frameworkExecOutput = useMemo(() => {
    const execTask = analysisTasks?.find((t) => t.step_name === 'execution_layer')
    const raw =
      execTask?.output_data && typeof execTask.output_data === 'object'
        ? execTask.output_data
        : taskData?.execution_layer
    return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  }, [analysisTasks, taskData])

  const kmF = effectiveResult?.key_metrics ?? {}
  const swotF = kmF.swot_analysis ?? (frameworkExecOutput?.swot_analysis as typeof kmF.swot_analysis)
  const jtbdF = kmF.jtbd ?? (frameworkExecOutput?.jtbd as typeof kmF.jtbd)
  const porter5F = kmF.porter_5_forces ?? (frameworkExecOutput?.porter_5_forces as typeof kmF.porter_5_forces)
  const breakdownF = kmF.opportunity_score_breakdown
  const frameworkPanelKeyF = `${effectiveResult?.reportId ?? 'live'}:${keyword}`

  const trendDone = isStepComplete(analysisTasks, 'trend_analysis')
  const competitionDone = isStepComplete(analysisTasks, 'competition_analysis')
  const insightDone = isStepComplete(analysisTasks, 'insight_extraction')
  const executionDone = isStepComplete(analysisTasks, 'execution_layer')

  const skSummary =
    loading && !trendDone && stableOppScore == null && !analysisFailed
  const skMarket = loading && !trendDone
  const skCompetition = loading && !competitionDone
  const skInsights = loading && !insightDone
  const skStrategic = loading && !executionDone
  const skInsightStrategy = skInsights || skStrategic
  const skAction = loading && !executionDone

  /** 파이프라인 래퍼와 동일 — `top-14`(3.5rem) 고정 헤더 오프셋 */
  const pipelineStickyTopPx = 56
  const pipelineRef = useRef<HTMLDivElement>(null)
  const [pipelineBlockHeight, setPipelineBlockHeight] = useState(0)
  const [tabBarHeight, setTabBarHeight] = useState(48)

  useLayoutEffect(() => {
    const el = pipelineRef.current
    if (!el) {
      setPipelineBlockHeight(0)
      return
    }
    const ro = new ResizeObserver(() => {
      setPipelineBlockHeight(Math.round(el.offsetHeight))
    })
    ro.observe(el)
    setPipelineBlockHeight(Math.round(el.offsetHeight))
    return () => ro.disconnect()
  }, [showPipeline, keyword, pipelineTimelineStages, reportId])

  const tabStickyTopPx = pipelineStickyTopPx + pipelineBlockHeight

  function renderAnalysisTimeline() {
    if (!showPipeline || !keyword.trim()) return null
    return (
      <div
        ref={pipelineRef}
        className="sticky top-14 z-30 -mx-1 border-b border-zinc-200/80 bg-background/95 px-1 pb-3 pt-1 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 dark:border-zinc-800 dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:-mx-2 sm:px-2"
      >
        <PipelineTimeline
          stages={pipelineTimelineStages}
          onRetry={(stageId) => {
            const taskId = uiStageIdToRetryTaskId(stageId)
            handleRetryPipelineStep(taskId)
          }}
          keyword={keyword.trim()}
          countryLabel={countryCode}
        />
      </div>
    )
  }

  if (!hasResultData && !hasPipelineContext) {
    return (
      <div className="rounded-xl border border-dashed border-slate-100 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        결과 요약 데이터가 없습니다. 분석이 완료되면 L자형 리포트가 표시됩니다.
      </div>
    )
  }

  if (!hasResultData && hasPipelineContext) {
    return (
      <div
        className={cn(analysisPageBg, 'rounded-xl px-2 py-4 sm:px-4 sm:py-6')}
        role="region"
        aria-label="분석 진행"
      >
        <div id="analysis-live-region" className="mx-auto max-w-3xl space-y-4">
          {renderAnalysisTimeline()}
          <p className="text-center text-sm text-muted-foreground">
            분석 데이터를 불러오는 중입니다. 잠시 후 요약 카드가 표시됩니다.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      id="analysis-live-region"
      className={cn(analysisPageBg, 'rounded-xl px-1 py-3 sm:px-2 sm:py-4 overflow-visible')}
      role="region"
      aria-label="분석 결과 대시보드"
    >
      <div className="mx-auto flex w-full max-w-none flex-col gap-8">
        {renderAnalysisTimeline()}

        <div className="flex min-h-0 flex-col gap-5 overflow-visible xl:min-h-[calc(100dvh-5rem)] xl:flex-row xl:items-start xl:gap-6">
          <div className="w-full shrink-0 xl:sticky xl:top-28 xl:z-10 xl:w-[min(100%,18rem)] xl:max-w-none xl:self-start xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:overflow-x-visible">
            <UrgentTaskCards
              result={effectiveResult ?? null}
              taskData={taskData}
              analysisTasks={analysisTasks ?? undefined}
              onNavigateToReportSection={scrollToReportSection}
            />
          </div>

          <div
            className="min-w-0 flex-1 space-y-3"
            style={
              {
                ['--report-anchor-offset' as string]: `${Math.max(96, tabStickyTopPx + tabBarHeight)}px`,
              } as CSSProperties
            }
          >
            <ReportSectionTabBar stickyTopPx={tabStickyTopPx} onTabBarHeight={setTabBarHeight} />
            <MotionReveal
              key={`main-${sectionKeyPrefix}`}
              staticLayout={loading}
              className="min-w-0 space-y-8"
              delay={0.06}
            >
              <section
                key={`${sectionKeyPrefix}-summary`}
                id="summary-section"
                className={sectionScrollClass}
              >
                <MotionReveal staticLayout={loading} delay={0.04}>
                  <div className="space-y-8 motion-safe:will-change-transform">
                    <div className="rounded-lg border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4 dark:border-zinc-800">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          📊 종합 요약
                        </h2>
                        <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                      </div>
                      <div className="space-y-6 px-3 pb-5 pt-4 sm:space-y-8 sm:px-4 sm:pb-6 sm:pt-5">
                        {skSummary ? (
                          <SectionContentSkeleton variant="mixed" className="py-2" />
                        ) : (
                          <>
                            <AnalysisMetaRow
                              keyword={keyword}
                              countryCode={countryCode}
                              updatedAt={effectiveResult?.updated_at ?? null}
                              className="px-0.5"
                            />
                            <div className="w-full rounded-lg border border-slate-100 bg-white px-3 py-5 sm:px-4 sm:py-6 dark:border-zinc-800 dark:bg-zinc-950">
                              <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">
                                <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-100 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10 dark:border-zinc-800">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    시장 기회 점수
                                  </p>
                                  <OpportunityScoreGauge
                                    score={liveOppNum}
                                    loading={loading && liveOppNum == null}
                                    stableScore={stableOppScore}
                                    analysisFailed={analysisFailed}
                                    rationaleSummary={scoreSummaryLeft}
                                  />
                                </div>
                                <div className="min-w-0 flex-1 space-y-5">
                                  <SummaryStatPills result={effectiveResult ?? null} />
                                  <TopPmActionsStrip
                                    result={effectiveResult ?? null}
                                    taskData={taskData}
                                    analysisTasks={analysisTasks ?? undefined}
                                  />
                                  <Collapsible defaultOpen={false}>
                                    <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-800/80 [&[data-state=open]_svg]:rotate-180">
                                      기회 점수 산출 근거 보기
                                      <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-3">
                                      {scoreReasonRight ? (
                                        <p className="text-pretty text-sm font-medium leading-relaxed text-slate-800 dark:text-zinc-100">
                                          {scoreReasonRight}
                                        </p>
                                      ) : (
                                        <p className="text-pretty text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                                          점수 분해·시장 섹션의 차원 지표와 함께 확인하세요.
                                        </p>
                                      )}
                                    </CollapsibleContent>
                                  </Collapsible>
                                </div>
                              </div>
                            </div>

                            <div
                              className="w-full space-y-5 rounded-lg border border-slate-100 bg-white px-3 py-5 sm:px-4 sm:py-6 dark:border-zinc-800 dark:bg-zinc-950"
                              aria-labelledby={`${sectionKeyPrefix}-conclusion-heading`}
                            >
                              <h3
                                id={`${sectionKeyPrefix}-conclusion-heading`}
                                className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400"
                              >
                                핵심 결론
                              </h3>
                              <ConclusionActionStrip result={effectiveResult ?? null} />
                              <Collapsible defaultOpen={false} className="mt-6 border-t border-slate-100 pt-5 dark:border-zinc-800">
                                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200 [&[data-state=open]_svg]:rotate-180">
                                  배경 및 근거 자세히 보기
                                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-4">
                                  <p className="mb-3 text-xs text-slate-500 dark:text-zinc-400">
                                    시장·경쟁 데이터에 기반한 요약입니다. 위 &quot;3줄 요약 액션&quot;과 동일 문장을 반복하지 않습니다.
                                  </p>
                                  <ConclusionStructuredBlocks markdown={conclusionFull} highlightTerms={highlightTerms} />
                                </CollapsibleContent>
                              </Collapsible>
                            </div>

                            <Collapsible defaultOpen={false}>
                              <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 [&[data-state=open]_svg]:rotate-180">
                                요약 카드 더보기
                                <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                              </CollapsibleTrigger>
                              <CollapsibleContent className="pt-4">
                                <ResultSummaryCards
                                  result={effectiveResult ?? null}
                                  consensusData={consensusData}
                                  taskData={taskData}
                                  analysisTasks={analysisTasks ?? undefined}
                                  loading={loading}
                                  variant="saas"
                                />
                              </CollapsibleContent>
                            </Collapsible>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </MotionReveal>
              </section>

                <InsightSectionShell
                  key={`${sectionKeyPrefix}-market`}
                  id="market-section"
                  title="📈 시장 분석"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={0}
                >
                  {skMarket ? (
                    <SectionContentSkeleton variant="grid" />
                  ) : (
                    <div className="space-y-8">
                      <OpportunityScoreBreakdown
                        score={effectiveResult?.key_metrics?.opportunity_score ?? null}
                        loading={loading}
                        stableScore={stableOppScore}
                        analysisFailed={analysisFailed}
                        breakdown={effectiveResult?.key_metrics?.opportunity_score_breakdown}
                        useKoreanLabels
                        className="border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      />
                      <AnalysisResultSections
                        key={`${sectionKeyPrefix}-ars-market`}
                        result={result}
                        taskData={taskData}
                        analysisTasks={analysisTasks}
                        consensusData={consensusData}
                        loading={loading}
                        keyword={keyword}
                        layout="pm-analytics"
                        sectionOnly="market-trends"
                      />
                    </div>
                  )}
                </InsightSectionShell>

                <InsightSectionShell
                  key={`${sectionKeyPrefix}-competition`}
                  id="competitor-section"
                  title="⚔️ 경쟁사 분석"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={1}
                >
                  {skCompetition ? (
                    <SectionContentSkeleton variant="mixed" />
                  ) : (
                    <AnalysisResultSections
                      key={`${sectionKeyPrefix}-ars-competition`}
                      result={result}
                      taskData={taskData}
                      analysisTasks={analysisTasks}
                      consensusData={consensusData}
                      loading={loading}
                      keyword={keyword}
                      layout="pm-analytics"
                      sectionOnly="competition"
                    />
                  )}
                </InsightSectionShell>

                <InsightSectionShell
                  key={`${sectionKeyPrefix}-insight-strat`}
                  id="insight-strategy-section"
                  title="💡 인사이트 · 전략"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={2}
                >
                  {skInsightStrategy ? (
                    <SectionContentSkeleton variant="mixed" />
                  ) : (
                    <div className="space-y-12">
                      <KeyMarketInsightsCard
                        key={`${sectionKeyPrefix}-kmic`}
                        result={effectiveResult ?? null}
                        taskData={taskData}
                        analysisTasks={analysisTasks}
                        newsList={newsList}
                        consensusData={consensusData}
                        loading={loading}
                        keyword={keyword}
                        onRetryExecutionLayer={() => handleRetryPipelineStep('execution_layer')}
                        withFooterBlocks={false}
                      />
                      <StrategyFrameworkPanel
                        key={frameworkPanelKeyF}
                        instanceKey={frameworkPanelKeyF}
                        swot={swotF}
                        jtbd={jtbdF}
                        porter={porter5F}
                        opportunityBreakdown={breakdownF ?? undefined}
                        strategicDecisionLayer={kmF.strategic_decision_layer}
                        strategyEvaluation={kmF.strategy_evaluation}
                        className="border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-950"
                      />
                      <AnalysisResultSections
                        key={`${sectionKeyPrefix}-ars-strategic`}
                        result={result}
                        taskData={taskData}
                        analysisTasks={analysisTasks}
                        consensusData={consensusData}
                        loading={loading}
                        keyword={keyword}
                        layout="pm-analytics"
                        sectionOnly="strategic"
                      />
                      <Collapsible defaultOpen={false}>
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-left text-sm font-medium text-slate-800 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-100 [&[data-state=open]_svg]:rotate-180">
                          전략 의사결정 상세 보기
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-4">
                          <StrategicDecisionLayer
                            key={`${sectionKeyPrefix}-sdl`}
                            result={effectiveResult ?? null}
                            loading={loading}
                            keyword={keyword}
                            embedded
                          />
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </InsightSectionShell>

                <section
                  key={`${sectionKeyPrefix}-action`}
                  id="action-section"
                  className={sectionScrollClass}
                >
                  <MotionReveal staticLayout={loading} delay={0.08}>
                    <div className="border-b border-slate-200/90 bg-white pb-8 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="space-y-1 border-b border-slate-100 px-1 pb-3 pt-1 sm:px-0 dark:border-zinc-800">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          🎯 PM 액션 플랜
                        </h2>
                        <p className="text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                          우선순위·성과·리스크를 확인한 뒤 실행 테이블에서 과제를 다듬으세요. 상태는 이 브라우저에만 저장됩니다.
                        </p>
                      </div>
                      <div className="space-y-10 px-0 pt-6">
                        {skAction ? (
                          <SectionContentSkeleton variant="list" />
                        ) : (
                          <>
                            <StrategyEvaluationSection
                              key={`${sectionKeyPrefix}-sev`}
                              result={effectiveResult ?? null}
                              loading={loading}
                              embedded
                            />
                            <div>
                              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                우선순위 · 예상 성과 · 전략적 리스크
                              </h3>
                              <KeyMarketInsightsCard
                                key={`${sectionKeyPrefix}-kmic-footer`}
                                result={effectiveResult ?? null}
                                taskData={taskData}
                                analysisTasks={analysisTasks}
                                newsList={newsList}
                                consensusData={consensusData}
                                loading={loading}
                                keyword={keyword}
                                onRetryExecutionLayer={() => handleRetryPipelineStep('execution_layer')}
                                variant="footer-only"
                              />
                            </div>
                            <StrategyExecutionTable
                              key={`${sectionKeyPrefix}-set`}
                              result={effectiveResult ?? null}
                              taskData={taskData}
                              analysisTasks={analysisTasks}
                              loading={loading}
                              keyword={keyword}
                              nested
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </MotionReveal>
                </section>
              </MotionReveal>
            </div>
          </div>
        </div>
      </div>
  )
}

function InsightSectionShell({
  id,
  title,
  result,
  children,
  loading = false,
  animationIndex = 0,
}: {
  id: string
  title: string
  result: ResearchResponse | null
  children: ReactNode
  loading?: boolean
  animationIndex?: number
}) {
  return (
    <MotionReveal staticLayout={loading} delay={0.08 + animationIndex * 0.05}>
      <section
        id={id}
        className={cn(sectionScrollClass, 'border-b border-slate-200/80 pb-2 dark:border-zinc-800')}
      >
        <div className="flex flex-row flex-wrap items-center justify-between gap-2 px-0 py-3">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{title}</h2>
          <AnalysisSourceButton result={result} label="출처" />
        </div>
        <div className="px-0 py-6">{children}</div>
      </section>
    </MotionReveal>
  )
}
