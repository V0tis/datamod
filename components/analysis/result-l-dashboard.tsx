'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { ResultLeftRail } from '@/components/analysis/result-left-rail'
import { analysisPageBg } from '@/components/analysis/analysis-card'
import { OverviewOpportunityRiskChart } from '@/components/analysis/overview-opportunity-risk-chart'
import { StrategyExecutionTable } from '@/components/analysis/strategy-execution-table'
import { AnalysisSourceButton } from '@/components/analysis/analysis-source-button'
import type { ResultPageStructuredSectionsProps } from '@/components/research/ResultPageStructuredSections'
import { OpportunityScoreBreakdown } from '@/components/research/OpportunityScoreBreakdown'
import { ResultSummaryCards } from '@/components/research/ResultSummaryCards'
import { StrategicDecisionLayer } from '@/components/research/StrategicDecisionLayer'
import { StrategyEvaluationSection } from '@/components/research/StrategyEvaluationSection'
import { AnalysisResultSections } from '@/components/research/AnalysisResultSections'
import { KeyMarketInsightsCard } from '@/components/research/KeyMarketInsightsCard'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { AnalysisPhaseRerunIcons } from '@/components/research/analysis-phase-rerun-icons'
import { MotionReveal } from '@/components/common/MotionReveal'
import { PipelineStepperSlim } from '@/components/research/dashboard/PipelineStepperSlim'
import { type PipelineSlimStatusContext } from '@/lib/analysis/pipeline-slim-status'
import { createIdleState, type StreamingState } from '@/lib/types/analysis-modes'
import { ReportScrollToc, scrollToReportSection } from '@/components/analysis/report-scroll-toc'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

function isStepComplete(
  tasks: Array<{ step_name: string; status: string }> | null | undefined,
  step: string
) {
  return tasks?.some((t) => t.step_name === step && t.status === 'completed') ?? false
}

/** 파이프라인 슬림 스텝 인덱스 → 리포트 앵커 id */
const PIPELINE_INDEX_TO_SECTION_ID = [
  'report-summary',
  'report-market',
  'report-competition',
  'report-insights',
  'report-strategic',
  'report-action',
  'report-summary',
  'report-summary',
  'report-summary',
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

const sectionScrollClass = 'scroll-mt-24'

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
    const id = PIPELINE_INDEX_TO_SECTION_ID[i] ?? 'report-summary'
    scrollToReportSection(id)
  }, [])

  const km = effectiveResult?.key_metrics
  const scoreRationale =
    sanitizeForKoreanDisplay(
      km?.strategic_decision_layer?.market_opportunity_explanation ?? km?.opportunity_score_reasoning
    )?.trim() || null
  const conclusionFull =
    sanitizeForKoreanDisplay(km?.summary_insights)?.trim() || '핵심 전략 방향을 분석 완료 후 확인할 수 있습니다.'

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
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
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
      className={cn(analysisPageBg, 'rounded-xl px-2 py-4 sm:px-4 sm:py-6')}
      role="region"
      aria-label="분석 결과 대시보드"
    >
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
        {showPipeline && keyword.trim() && (
          <div className="z-30 py-0.5 lg:sticky lg:top-16">
            <PipelineStepperSlim
              keyword={keyword}
              selectedIndex={userPinnedPipeline ? pickedPipelineIndex : null}
              onStepClick={handlePipelineStep}
              {...slimCtx}
            />
          </div>
        )}

        <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
          <div className="shrink-0 xl:sticky xl:top-20 xl:w-52 xl:self-start">
            <ReportScrollToc className="xl:shadow-md" />
          </div>

          <div className="min-w-0 flex-1 space-y-8">
            <div className="grid gap-8 lg:grid-cols-[minmax(260px,320px)_1fr] lg:items-start lg:gap-10">
              <MotionReveal
                key={`rail-${sectionKeyPrefix}`}
                staticLayout={loading}
                className="min-w-0"
                delay={0}
              >
                <ResultLeftRail
                  effectiveResult={effectiveResult ?? null}
                  taskData={taskData}
                  analysisTasks={analysisTasks ?? undefined}
                  loading={loading}
                  onNavigateToReportSection={scrollToReportSection}
                  stableOpportunityScore={stableOppScore}
                  analysisFailed={analysisFailed}
                  scoreRationaleSummary={scoreRationale}
                  conclusionFull={conclusionFull}
                />
              </MotionReveal>

              <MotionReveal
                key={`main-${sectionKeyPrefix}`}
                staticLayout={loading}
                className="min-w-0 space-y-10"
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
                  key={`${sectionKeyPrefix}-report-summary`}
                  id="report-summary"
                  className={sectionScrollClass}
                >
                  <MotionReveal staticLayout={loading} delay={0.04}>
                    <Card className="border-slate-100 bg-white p-0 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 motion-safe:will-change-transform">
                      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-slate-100 pb-4 dark:border-zinc-800">
                        <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          요약 · 기회 점수
                        </CardTitle>
                        <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                      </CardHeader>
                      <CardContent className="space-y-8 pb-6 pt-6">
                        {skSummary ? (
                          <SectionContentSkeleton variant="mixed" className="py-2" />
                        ) : (
                          <>
                            <OpportunityScoreBreakdown
                              score={effectiveResult?.key_metrics?.opportunity_score ?? null}
                              loading={loading}
                              stableScore={stableOppScore}
                              analysisFailed={analysisFailed}
                              breakdown={effectiveResult?.key_metrics?.opportunity_score_breakdown}
                              useKoreanLabels
                              className="border-slate-100 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                            />
                            <OverviewOpportunityRiskChart result={effectiveResult ?? null} loading={loading} />
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
                      </CardContent>
                    </Card>
                  </MotionReveal>
                </section>

                <InsightSectionShell
                  key={`${sectionKeyPrefix}-report-market`}
                  id="report-market"
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
                  key={`${sectionKeyPrefix}-report-competition`}
                  id="report-competition"
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
                  key={`${sectionKeyPrefix}-report-insights`}
                  id="report-insights"
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
                  key={`${sectionKeyPrefix}-report-strategic`}
                  id="report-strategic"
                  className={sectionScrollClass}
                >
                  <MotionReveal staticLayout={loading} delay={0.06}>
                    <Card className="border-slate-100 bg-white p-0 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-slate-100 dark:border-zinc-800">
                        <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          전략 · 프레임워크 · GTM · 평가
                        </CardTitle>
                        <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                      </CardHeader>
                      <CardContent className="space-y-8 pb-6 pt-6">
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
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </MotionReveal>
                </section>

                <section
                  key={`${sectionKeyPrefix}-report-action`}
                  id="report-action"
                  className={sectionScrollClass}
                >
                  <MotionReveal staticLayout={loading} delay={0.08}>
                    <Card className="border-slate-100 bg-white p-0 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                      <CardHeader className="space-y-1 border-b border-slate-100 dark:border-zinc-800">
                        <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                          액션 플랜
                        </CardTitle>
                        <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                          상태는 이 브라우저에만 저장됩니다. 실행 과제를 배포·공유할 때는 별도 워크플로에 반영하세요.
                        </p>
                      </CardHeader>
                      <CardContent className="pb-6 pt-4">
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
                          />
                        )}
                      </CardContent>
                    </Card>
                  </MotionReveal>
                </section>
              </MotionReveal>
            </div>
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
      <section id={id} className={cn(sectionScrollClass)}>
        <Card className="border-slate-100 bg-white p-0 shadow-sm transition-transform duration-200 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 border-b border-slate-100 dark:border-zinc-800">
            <CardTitle className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{title}</CardTitle>
            <AnalysisSourceButton result={result} label="출처" />
          </CardHeader>
          <CardContent className="pb-6 pt-6">{children}</CardContent>
        </Card>
      </section>
    </MotionReveal>
  )
}
