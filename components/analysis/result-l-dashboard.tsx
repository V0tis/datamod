'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { injectKeywordBold } from '@/lib/text-keyword-bold'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { AnalysisPhaseRerunIcons } from '@/components/research/analysis-phase-rerun-icons'
import { MotionReveal } from '@/components/common/MotionReveal'
import { PipelineStepperSlim } from '@/components/research/dashboard/PipelineStepperSlim'
import { type PipelineSlimStatusContext } from '@/lib/analysis/pipeline-slim-status'
import { createIdleState, type StreamingState } from '@/lib/types/analysis-modes'
import { scrollToReportSection } from '@/components/analysis/report-scroll-toc'
import { ReportSectionTabBar } from '@/components/analysis/report-section-tab-bar'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { ConclusionStructuredBlocks } from '@/components/research/ConclusionStructuredBlocks'
import { stripLeadingMarkdownHeadings } from '@/lib/strip-markdown-heading-markers'

function isStepComplete(
  tasks: Array<{ step_name: string; status: string }> | null | undefined,
  step: string
) {
  return tasks?.some((t) => t.step_name === step && t.status === 'completed') ?? false
}

/** 파이프라인 슬림 스텝 인덱스 → 리포트 앵커 id (`lib/report-section-ids`와 동일) */
const PIPELINE_INDEX_TO_SECTION_ID = [
  'summary',
  'market',
  'competition',
  'insights',
  'strategic',
  'action',
  'summary',
  'summary',
  'summary',
] as const

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
}

/** 글로벌 헤더(3.5rem) + 리포트 탭(~3.25rem) 대략 보정 — smooth scroll 시 제목이 가리지 않게 */
const sectionScrollClass = 'scroll-mt-[6.75rem] md:scroll-mt-[7.5rem]'

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
}: ResultLDashboardProps) {
  const streamingState = streamingStateProp ?? createIdleState()
  const effectiveResult = displayResult ?? result
  const hasResultData = !!(effectiveResult?.reportId ?? effectiveResult?.key_metrics)
  const hasPipelineContext =
    (analysisTasks?.length ?? 0) > 0 ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming' ||
    streamingState.status === 'completed'

  const [userPinnedPipeline, setUserPinnedPipeline] = useState(false)
  const [pickedPipelineIndex, setPickedPipelineIndex] = useState<number | null>(null)

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

  useEffect(() => {
    setUserPinnedPipeline(false)
    setPickedPipelineIndex(null)
  }, [reportId])

  const streamDone = streamingState.status === 'completed' && !pipelineHasError
  const streamingLive =
    streamingState.status === 'running' || streamingState.status === 'streaming' ? streamingState : null
  const streamingStepIdLive = streamingLive?.stepId
  const streamingCurrentStepLive = streamingLive?.currentStep

  const timelineStep = useMemo(() => {
    if (polledStatus === 'running' && polledProgressStep != null) {
      return Math.min(7, Math.max(0, polledProgressStep))
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

  const slimCtx: PipelineSlimStatusContext = useMemo(
    () => ({
      analysisTasks,
      streamingStepId: streamingStepIdLive,
      currentStep: timelineStep,
      allCompleted,
      hasError: pipelineHasError,
      errorStepIndex: pipelineErrorStepIndex,
      result: effectiveResult ?? null,
    }),
    [
      analysisTasks,
      streamingStepIdLive,
      timelineStep,
      allCompleted,
      pipelineHasError,
      pipelineErrorStepIndex,
      effectiveResult,
    ]
  )

  const showPipeline =
    polledProgressStep != null ||
    !!polledStatus ||
    streamingState.status !== 'idle' ||
    displayResult != null ||
    streamDone ||
    pipelineLoading

  const handlePipelineStep = useCallback((i: number) => {
    setUserPinnedPipeline(true)
    setPickedPipelineIndex(i)
    const id = PIPELINE_INDEX_TO_SECTION_ID[i] ?? 'summary'
    scrollToReportSection(id)
  }, [])

  const km = effectiveResult?.key_metrics
  const scoreRationale =
    sanitizeForKoreanDisplay(
      km?.strategic_decision_layer?.market_opportunity_explanation ?? km?.opportunity_score_reasoning
    )?.trim() || null
  const conclusionFull = stripLeadingMarkdownHeadings(
    sanitizeForKoreanDisplay(km?.summary_insights)?.trim() || '핵심 전략 방향을 분석 완료 후 확인할 수 있습니다.'
  )

  const conclusionExcerpt = useMemo(() => {
    const t = conclusionFull.replace(/\s+/g, ' ').trim()
    if (t.length <= 360) return t
    return `${t.slice(0, 360).trimEnd()}…`
  }, [conclusionFull])

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

  const conclusionExcerptHighlighted = useMemo(
    () => injectKeywordBold(conclusionExcerpt, highlightTerms),
    [conclusionExcerpt, highlightTerms]
  )

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
  const skAction = loading && !executionDone

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
          {showPipeline && keyword.trim() && (
            <PipelineStepperSlim
              keyword={keyword}
              selectedIndex={userPinnedPipeline ? pickedPipelineIndex : null}
              onStepClick={handlePipelineStep}
              {...slimCtx}
            />
          )}
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
      <div className="mx-auto flex w-full max-w-none flex-col gap-1">
        {showPipeline && keyword.trim() && (
          <div className="z-30 py-0 lg:sticky lg:top-16">
            <PipelineStepperSlim
              keyword={keyword}
              selectedIndex={userPinnedPipeline ? pickedPipelineIndex : null}
              onStepClick={handlePipelineStep}
              {...slimCtx}
            />
          </div>
        )}

        <div className="flex min-h-0 flex-col gap-5 overflow-visible xl:min-h-[calc(100dvh-5rem)] xl:flex-row xl:items-start xl:gap-6">
          <div className="w-full shrink-0 xl:sticky xl:top-28 xl:z-10 xl:w-[min(100%,18rem)] xl:max-w-none xl:self-start xl:max-h-[calc(100dvh-8rem)] xl:overflow-y-auto xl:overflow-x-visible">
            <UrgentTaskCards
              result={effectiveResult ?? null}
              taskData={taskData}
              analysisTasks={analysisTasks ?? undefined}
              onNavigateToReportSection={scrollToReportSection}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <ReportSectionTabBar />
            <MotionReveal
              key={`main-${sectionKeyPrefix}`}
              staticLayout={loading}
              className="min-w-0 space-y-8"
              delay={0.06}
            >
              {keyword.trim() ? (
                <div className="flex justify-end">
                  <AnalysisPhaseRerunIcons
                    keyword={keyword}
                    countryCode={countryCode}
                    aiPrimaryModel={aiPrimaryModel}
                    disabled={phaseRerunDisabled}
                    className="shrink-0"
                  />
                </div>
              ) : null}

              <section
                key={`${sectionKeyPrefix}-summary`}
                id="summary"
                className={sectionScrollClass}
              >
                <MotionReveal staticLayout={loading} delay={0.04}>
                  <div className="space-y-8 motion-safe:will-change-transform">
                    <div className="rounded-lg border border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-950/30">
                      <div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 pb-3 pt-4 sm:px-4 dark:border-zinc-800">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          요약 · 기회 점수
                        </h2>
                        <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                      </div>
                      <div className="space-y-6 px-3 pb-5 pt-4 sm:space-y-8 sm:px-4 sm:pb-6 sm:pt-5">
                        {skSummary ? (
                          <SectionContentSkeleton variant="mixed" className="py-2" />
                        ) : (
                          <>
                            {/* Hero: 최종 점수 + 핵심 결론 요약 */}
                            <div className="w-full rounded-lg border border-slate-100 bg-white px-3 py-5 sm:px-4 sm:py-6 dark:border-zinc-800 dark:bg-zinc-900/80">
                              <div className="flex flex-col gap-8 lg:flex-row lg:items-stretch lg:gap-10">
                                <div className="flex shrink-0 flex-col items-center justify-center border-b border-slate-100 pb-8 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10 dark:border-zinc-800">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    최종 점수 요약
                                  </p>
                                  <OpportunityScoreGauge
                                    score={liveOppNum}
                                    loading={loading && liveOppNum == null}
                                    stableScore={stableOppScore}
                                    analysisFailed={analysisFailed}
                                    rationaleSummary={scoreRationale}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                                    핵심 결론 요약
                                  </p>
                                  <p className="text-pretty text-base font-medium leading-relaxed text-slate-900 dark:text-zinc-50">
                                    {conclusionExcerptHighlighted}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* 전폭 핵심 결론: 3줄 액션 + 본문 */}
                            <div
                              className="w-full space-y-5 rounded-lg border border-slate-100 bg-white px-3 py-5 sm:px-4 sm:py-6 dark:border-zinc-800 dark:bg-zinc-900/40"
                              aria-labelledby={`${sectionKeyPrefix}-conclusion-heading`}
                            >
                              <h3
                                id={`${sectionKeyPrefix}-conclusion-heading`}
                                className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400"
                              >
                                핵심 결론
                              </h3>
                              <ConclusionActionStrip result={effectiveResult ?? null} />
                              <ConclusionStructuredBlocks markdown={conclusionFull} highlightTerms={highlightTerms} />
                            </div>

                            {/* 근거: 점수 분해 + 전략 프레임워크 레이더 */}
                            <div className="grid w-full gap-6 lg:grid-cols-2 lg:items-start">
                              <OpportunityScoreBreakdown
                                score={effectiveResult?.key_metrics?.opportunity_score ?? null}
                                loading={loading}
                                stableScore={stableOppScore}
                                analysisFailed={analysisFailed}
                                breakdown={effectiveResult?.key_metrics?.opportunity_score_breakdown}
                                useKoreanLabels
                                className="h-full border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
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
                                summaryRadarOnly
                                className="h-full"
                              />
                            </div>

                            <ResultSummaryCards
                              result={effectiveResult ?? null}
                              consensusData={consensusData}
                              taskData={taskData}
                              analysisTasks={analysisTasks ?? undefined}
                              loading={loading}
                              variant="saas"
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </MotionReveal>
              </section>

                <InsightSectionShell
                  key={`${sectionKeyPrefix}-market`}
                  id="market"
                  title="시장 트렌드 · 수요 신호"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={0}
                >
                  {skMarket ? (
                    <SectionContentSkeleton variant="grid" />
                  ) : (
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
                  )}
                </InsightSectionShell>

                <InsightSectionShell
                  key={`${sectionKeyPrefix}-competition`}
                  id="competition"
                  title="경쟁 환경 · 포지셔닝"
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
                  key={`${sectionKeyPrefix}-insights`}
                  id="insights"
                  title="핵심 인사이트"
                  result={effectiveResult ?? null}
                  loading={loading}
                  animationIndex={2}
                >
                  {skInsights ? (
                    <SectionContentSkeleton variant="list" />
                  ) : (
                    <KeyMarketInsightsCard
                      key={`${sectionKeyPrefix}-kmic`}
                      result={effectiveResult ?? null}
                      taskData={taskData}
                      analysisTasks={analysisTasks}
                      newsList={newsList}
                      consensusData={consensusData}
                      loading={loading}
                      keyword={keyword}
                    />
                  )}
                </InsightSectionShell>

                <section
                  key={`${sectionKeyPrefix}-strategic`}
                  id="strategic"
                  className={sectionScrollClass}
                >
                  <MotionReveal staticLayout={loading} delay={0.06}>
                    <div className="border-b border-slate-200/90 bg-white pb-6 dark:border-zinc-800 dark:bg-zinc-950/20">
                      <div className="flex flex-row flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-1 pb-3 pt-1 sm:px-0 dark:border-zinc-800">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          전략 · 프레임워크 · GTM · 평가
                        </h2>
                        <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                      </div>
                      <div className="space-y-10 px-0 pb-2 pt-6 sm:px-0">
                        {skStrategic ? (
                          <SectionContentSkeleton variant="mixed" />
                        ) : (
                          <>
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
                            <StrategicDecisionLayer
                              key={`${sectionKeyPrefix}-sdl`}
                              result={effectiveResult ?? null}
                              loading={loading}
                              keyword={keyword}
                              embedded
                            />
                            <StrategyEvaluationSection
                              key={`${sectionKeyPrefix}-sev`}
                              result={effectiveResult ?? null}
                              loading={loading}
                              embedded
                            />
                          </>
                        )}
                      </div>
                    </div>
                  </MotionReveal>
                </section>

                <section
                  key={`${sectionKeyPrefix}-action`}
                  id="action"
                  className={sectionScrollClass}
                >
                  <MotionReveal staticLayout={loading} delay={0.08}>
                    <div className="border-b border-slate-200/90 bg-white pb-6 dark:border-zinc-800 dark:bg-zinc-950/20">
                      <div className="space-y-1 border-b border-slate-100 px-1 pb-3 pt-1 sm:px-0 dark:border-zinc-800">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          액션 플랜
                        </h2>
                        <p className="text-sm leading-relaxed text-slate-500 dark:text-zinc-400">
                          상태는 이 브라우저에만 저장됩니다. 실행 과제를 배포·공유할 때는 별도 워크플로에 반영하세요.
                        </p>
                      </div>
                      <div className="px-0 pt-5">
                        {skAction ? (
                          <SectionContentSkeleton variant="list" />
                        ) : (
                          <StrategyExecutionTable
                            key={`${sectionKeyPrefix}-set`}
                            result={effectiveResult ?? null}
                            taskData={taskData}
                            analysisTasks={analysisTasks}
                            loading={loading}
                            keyword={keyword}
                            nested
                          />
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
