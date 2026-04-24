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
import { UrgentTaskCards } from '@/components/analysis/urgent-task-cards'
import { AnalysisSourceButton } from '@/components/analysis/analysis-source-button'
import type { ResultPageStructuredSectionsProps } from '@/components/research/ResultPageStructuredSections'
import { OpportunityScoreBreakdown } from '@/components/research/OpportunityScoreBreakdown'
import { ResultSummaryCards } from '@/components/research/ResultSummaryCards'
import { StrategicDecisionLayer } from '@/components/research/StrategicDecisionLayer'
import { AnalysisResultSections } from '@/components/research/AnalysisResultSections'
import { InsightStrategyTabsPanel } from '@/components/research/InsightStrategyTabsPanel'
import { PmActionPlanSection } from '@/components/analysis/pm-action-plan/pm-action-plan-section'
import { SummaryExecutiveThreeZones } from '@/components/analysis/results/SummaryExecutiveThreeZones'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { MotionReveal } from '@/components/common/MotionReveal'
import { useResearchStore } from '@/lib/stores/research-store'
import { toast } from 'sonner'
import { taskIdToResearchRunOptions } from '@/lib/analysis/pipeline-task-retry'
import { buildPipelineTimelineStages } from '@/lib/analysis/build-pipeline-timeline-stages'
import { AnalysisResultHeaderBar, type AnalysisHeaderRunState } from '@/components/analysis/results/AnalysisResultHeaderBar'
import { CompactPipelineBar } from '@/components/analysis/results/CompactPipelineBar'
import { createIdleState, type StreamingState } from '@/lib/types/analysis-modes'
import { scrollToReportSection } from '@/components/analysis/report-scroll-toc'
import { ReportSectionTabBar } from '@/components/analysis/report-section-tab-bar'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { stripLeadingMarkdownHeadings } from '@/lib/strip-markdown-heading-markers'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { AnalysisMetaRow } from '@/components/analysis/analysis-summary-header'
import { AnalysisDepthQualityBadge, type ResultDepthLayout } from '@/components/analysis/AnalysisDepthQualityBadge'
import { NineStagePipelineOverview } from '@/components/analysis/results/NineStagePipelineOverview'
import { StrategyEvaluationSection } from '@/components/research/StrategyEvaluationSection'
function isStepComplete(
  tasks: Array<{ step_name: string; status: string }> | null | undefined,
  step: string
) {
  return tasks?.some((t) => t.step_name === step && t.status === 'completed') ?? false
}

type ResultLDashboardProps = ResultPageStructuredSectionsProps & {
  /** research_history.analysis_depth: fast | standard | deep */
  analysisDepth?: 'fast' | 'standard' | 'deep' | null
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
  analysisDepth = null,
}: ResultLDashboardProps) {
  const streamingState = streamingStateProp ?? createIdleState()
  const effectiveResult = displayResult ?? result
  const depthLayout: ResultDepthLayout =
    analysisDepth === 'fast' || analysisDepth === 'deep' ? analysisDepth : 'standard'
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

  /** 글로벌 네비 높이(h-14) + 스티키 스택(헤더·파이프라인·탭) — 스크롤 앵커·스파이 기준 */
  const navOffsetPx = 56
  const stickyStackRef = useRef<HTMLDivElement>(null)
  const [stickyStackHeight, setStickyStackHeight] = useState(0)

  useLayoutEffect(() => {
    const el = stickyStackRef.current
    if (!el) {
      setStickyStackHeight(0)
      return
    }
    const ro = new ResizeObserver(() => {
      setStickyStackHeight(Math.round(el.offsetHeight))
    })
    ro.observe(el)
    setStickyStackHeight(Math.round(el.offsetHeight))
    return () => ro.disconnect()
  }, [showPipeline, keyword, pipelineTimelineStages, reportId])

  const scrollAnchorTopPx = navOffsetPx + stickyStackHeight

  const headerRunState: AnalysisHeaderRunState = pipelineHasError
    ? 'error'
    : pipelineInFlight
      ? 'running'
      : allCompleted && !!effectiveResult?.reportId
        ? 'completed'
        : 'idle'

  function renderAnalysisStickyStack() {
    if (!showPipeline || !keyword.trim()) return null
    return (
      <div
        ref={stickyStackRef}
        className="sticky top-14 z-30 -mx-1 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)] sm:-mx-2"
      >
        <AnalysisResultHeaderBar
          keyword={keyword.trim()}
          countryCode={countryCode}
          runState={headerRunState}
          aiPrimaryModel={aiPrimaryModel}
          displayResult={effectiveResult ?? null}
          taskData={taskData}
          disabled={phaseRerunDisabled}
        />
        <CompactPipelineBar stages={pipelineTimelineStages} isRunning={pipelineInFlight} />
        <ReportSectionTabBar scrollAnchorTopPx={scrollAnchorTopPx} />
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
        <div id="analysis-live-region" className="mx-auto w-full max-w-none space-y-4 px-2 sm:px-4">
          {renderAnalysisStickyStack()}
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
      className={cn(analysisPageBg, 'dm-analytics-page rounded-xl px-1 py-3 sm:px-2 sm:py-4 overflow-visible')}
      role="region"
      aria-label="분석 결과 대시보드"
    >
      <div className="mx-auto flex w-full max-w-none flex-col gap-8">
        {renderAnalysisStickyStack()}

        {depthLayout === 'deep' && allCompleted && hasResultData ? (
          <NineStagePipelineOverview className="mb-2" currentStageIndex={8} />
        ) : null}

        <div
          className={cn(
            'flex min-h-0 flex-col gap-5 overflow-visible xl:min-h-[calc(100dvh-5rem)] xl:flex-row xl:items-start xl:gap-6',
            depthLayout === 'fast' && 'xl:gap-4'
          )}
        >
          <div
            className={cn(
              'w-full shrink-0 xl:sticky xl:top-28 xl:z-10 xl:max-w-none xl:self-start xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:overflow-x-visible',
              depthLayout === 'fast' ? 'xl:w-[min(100%,14rem)]' : 'xl:w-[min(100%,18rem)]'
            )}
          >
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
                ['--report-anchor-offset' as string]: `${Math.max(96, scrollAnchorTopPx)}px`,
              } as CSSProperties
            }
          >
            <MotionReveal
              key={`main-${sectionKeyPrefix}`}
              staticLayout={loading}
              className={cn('min-w-0', depthLayout === 'fast' ? 'space-y-4' : 'space-y-8')}
              delay={0.06}
            >
              <section
                key={`${sectionKeyPrefix}-summary`}
                id="summary-section"
                className={cn(sectionScrollClass, depthLayout === 'fast' ? 'mb-8' : 'mb-12')}
              >
                <MotionReveal staticLayout={loading} delay={0.04}>
                  <div
                    className={cn(
                      'motion-safe:will-change-transform',
                      depthLayout === 'fast' ? 'mx-auto max-w-3xl space-y-4' : 'space-y-8'
                    )}
                  >
                    <div className="w-full rounded-lg border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4 dark:border-zinc-800">
                        <ReportSectionTitleRow
                          title="종합 요약"
                          badge="요약"
                          right={
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              {allCompleted && analysisDepth ? (
                                <AnalysisDepthQualityBadge depth={depthLayout} />
                              ) : null}
                              <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                            </div>
                          }
                        />
                      </div>
                      <div
                        className={cn(
                          'px-3 pb-5 pt-4 sm:px-4 sm:pb-6 sm:pt-5',
                          depthLayout === 'fast' ? 'space-y-4' : 'space-y-6 sm:space-y-8'
                        )}
                      >
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
                            <SummaryExecutiveThreeZones
                              result={effectiveResult ?? null}
                              taskData={taskData}
                              analysisTasks={analysisTasks}
                              opportunityScore={stableOppScore}
                              scoreLoading={loading && liveOppNum == null && !analysisFailed}
                              analysisFailed={analysisFailed}
                              conclusionBackgroundMarkdown={conclusionFull}
                              highlightTerms={highlightTerms}
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
                                ) : scoreSummaryLeft ? (
                                  <p className="text-pretty text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{scoreSummaryLeft}</p>
                                ) : (
                                  <p className="text-pretty text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                                    점수 분해·시장 섹션의 차원 지표와 함께 확인하세요.
                                  </p>
                                )}
                              </CollapsibleContent>
                            </Collapsible>

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
                  title="시장 분석"
                  badge="시장"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={0}
                  qualityStamp={
                    allCompleted && analysisDepth ? <AnalysisDepthQualityBadge depth={depthLayout} className="scale-90" /> : null
                  }
                >
                  {skMarket ? (
                    <SectionContentSkeleton variant="grid" />
                  ) : (
                    <div className="space-y-8">
                      <OpportunityScoreBreakdown
                        embedded
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
                  title="경쟁사 분석"
                  badge="경쟁"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={1}
                  qualityStamp={
                    allCompleted && analysisDepth ? <AnalysisDepthQualityBadge depth={depthLayout} className="scale-90" /> : null
                  }
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
                  title="인사이트 · 전략"
                  badge="전략"
                  hideTitle
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={2}
                  qualityStamp={
                    allCompleted && analysisDepth ? <AnalysisDepthQualityBadge depth={depthLayout} className="scale-90" /> : null
                  }
                >
                  {skInsightStrategy ? (
                    <SectionContentSkeleton variant="mixed" />
                  ) : (
                    <div className={depthLayout === 'deep' ? 'space-y-10' : 'space-y-12'}>
                      {depthLayout === 'deep' ? (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-200">
                            교차검증 근거 · 리스크 완화 전략
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            정량·정성 신호를 대조한 신뢰도와, 완화 가능성·실행 난이도·우선순위를 정리했습니다.
                          </p>
                          <StrategyEvaluationSection
                            result={effectiveResult ?? null}
                            loading={loading}
                            embedded
                            showEmbeddedHeading={false}
                            emphasis="deep"
                          />
                        </div>
                      ) : depthLayout === 'standard' ? (
                        <StrategyEvaluationSection
                          result={effectiveResult ?? null}
                          loading={loading}
                          embedded
                          showEmbeddedHeading={false}
                          emphasis="default"
                        />
                      ) : null}
                      <InsightStrategyTabsPanel
                        key={`${sectionKeyPrefix}-istp`}
                        result={effectiveResult ?? null}
                        taskData={taskData}
                        analysisTasks={analysisTasks}
                        newsList={newsList}
                        consensusData={consensusData}
                        loading={loading}
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
                        strategicOmitFrameworks
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
                  className={cn(sectionScrollClass, 'mb-12')}
                >
                  <MotionReveal staticLayout={loading} delay={0.08}>
                    <div className="border-b border-slate-200/90 bg-white pb-8 dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="space-y-3 border-b border-slate-100 px-1 pb-4 pt-1 sm:px-0 dark:border-zinc-800">
                        <ReportSectionTitleRow
                          title="PM 액션 플랜"
                          badge="실행"
                          right={
                            allCompleted && analysisDepth ? (
                              <AnalysisDepthQualityBadge depth={depthLayout} className="scale-90" />
                            ) : null
                          }
                        />
                        <p className="text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                          우선순위·성과·리스크를 확인한 뒤 실행 테이블에서 과제를 다듬으세요. 상태는 이 브라우저에만 저장됩니다.
                        </p>
                      </div>
                      <div className="space-y-10 px-0 pt-6">
                        {skAction ? (
                          <SectionContentSkeleton variant="list" />
                        ) : (
                          <>
                            <PmActionPlanSection
                              key={`${sectionKeyPrefix}-pmap`}
                              result={effectiveResult ?? null}
                              taskData={taskData}
                              analysisTasks={analysisTasks}
                              consensusData={consensusData}
                              loading={loading}
                              keyword={keyword}
                              onRetryExecutionLayer={() => handleRetryPipelineStep('execution_layer')}
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

function ReportSectionTitleRow({
  title,
  badge,
  right,
}: {
  title: string
  badge?: string
  right?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <div className="h-6 w-1 shrink-0 rounded-full bg-blue-500" aria-hidden />
      <h2 className="text-lg font-bold text-slate-900 dark:text-zinc-50">{title}</h2>
      {badge ? (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
          {badge}
        </span>
      ) : null}
      <div className="h-px min-w-[2rem] flex-1 bg-gray-100 dark:bg-zinc-800" />
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  )
}

function InsightSectionShell({
  id,
  title,
  badge,
  hideTitle = false,
  result,
  children,
  loading = false,
  animationIndex = 0,
  qualityStamp,
}: {
  id: string
  title: string
  badge?: string
  /** true면 바깥 H2·배지는 숨기고 출처만 표시(카드 내부에 제목이 있을 때) */
  hideTitle?: boolean
  result: ResearchResponse | null
  children: ReactNode
  loading?: boolean
  animationIndex?: number
  qualityStamp?: ReactNode
}) {
  const sourceBtn = <AnalysisSourceButton result={result} label="출처" />
  return (
    <MotionReveal staticLayout={loading} delay={0.08 + animationIndex * 0.05}>
      <section
        id={id}
        className={cn(sectionScrollClass, 'mb-12 border-b border-slate-200/80 pb-8 dark:border-zinc-800')}
      >
        {hideTitle ? (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            {qualityStamp}
            {sourceBtn}
          </div>
        ) : (
          <ReportSectionTitleRow
            title={title}
            badge={badge}
            right={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {qualityStamp}
                {sourceBtn}
              </div>
            }
          />
        )}
        <div className="w-full px-0 pt-0">{children}</div>
      </section>
    </MotionReveal>
  )
}
