 'use client'

import { useCallback, useMemo, useRef, useLayoutEffect, useState, type CSSProperties } from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { UrgentTaskCards } from '@/components/analysis/urgent-task-cards'
import { AnalysisSourceButton } from '@/components/analysis/analysis-source-button'
import type { ResultPageStructuredSectionsProps } from '@/components/research/ResultPageStructuredSections'
import { OpportunityScoreBreakdown } from '@/components/research/OpportunityScoreBreakdown'
import { ResultSummaryCards } from '@/components/research/ResultSummaryCards'
import { AnalysisResultSections } from '@/components/research/AnalysisResultSections'
import { InsightStrategyTabsPanel } from '@/components/research/InsightStrategyTabsPanel'
import { PmActionPlanSection } from '@/components/analysis/pm-action-plan/pm-action-plan-section'
import { useResearchStore } from '@/lib/stores/research-store'
import { toast } from 'sonner'
import { taskIdToResearchRunOptions } from '@/lib/analysis/pipeline-task-retry'
import { buildPipelineTimelineStages } from '@/lib/analysis/build-pipeline-timeline-stages'
import { AnalysisResultHeaderBar, type AnalysisHeaderRunState } from '@/components/analysis/results/AnalysisResultHeaderBar'
import { CompactPipelineBar } from '@/components/analysis/results/CompactPipelineBar'
import { createIdleState, type StreamingState } from '@/lib/types/analysis-modes'
import { scrollToReportSection } from '@/components/analysis/report-scroll-toc'
import { ReportSectionTabBar } from '@/components/analysis/report-section-tab-bar'
import { AnalysisMetaRow } from '@/components/analysis/analysis-summary-header'
import { AnalysisDepthQualityBadge, type ResultDepthLayout } from '@/components/analysis/AnalysisDepthQualityBadge'
import { NineStagePipelineOverview } from '@/components/analysis/results/NineStagePipelineOverview'
import { BarChart3, Users, Lightbulb, CheckSquare, ExternalLink } from 'lucide-react'

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

const sectionScrollClass = 'scroll-mt-[var(--report-anchor-offset)]'

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
  const hasPipelineContext = (analysisTasks?.length ?? 0) > 0 || streamingState.status !== 'idle'

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

  const liveOpp = effectiveResult?.key_metrics?.opportunity_score
  const stableOppScore = typeof liveOpp === 'number' && Number.isFinite(liveOpp) ? liveOpp : null

  const streamDone = streamingState.status === 'completed' && !pipelineHasError

  const pipelineInFlight =
    !!pipelineLoading ||
    analysisBusy ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming' ||
    polledStatus === 'running'

  const analysisTasksForPipeline = useMemo(() => (analysisTasks?.length ? analysisTasks : null), [analysisTasks])
  const streamingCurrentStep =
    'currentStep' in streamingState ? streamingState.currentStep : undefined
  const streamingStepId = 'stepId' in streamingState ? streamingState.stepId : undefined

  const timelineStep = useMemo(() => {
    if (polledStatus === 'running' && polledProgressStep != null) {
      return Math.min(8, Math.max(0, polledProgressStep))
    }
    if (streamingState.status === 'running' || streamingState.status === 'streaming') {
      return streamingCurrentStep ?? -1
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
    streamingState.status,
    streamingCurrentStep,
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
        analysisTasks: analysisTasksForPipeline as Parameters<typeof buildPipelineTimelineStages>[0]['analysisTasks'],
        taskData,
        streamingStepId,
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
    streamingStepId,
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

  const sectionCardClass = 'bg-white border border-[#E5E8EF] rounded-xl p-6'
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
  }, [showPipeline, keyword, pipelineTimelineStages])

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
        className="sticky top-14 z-30 -mx-1 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:-mx-2"
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
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">
        결과 요약 데이터가 없습니다. 분석이 완료되면 L자형 리포트가 표시됩니다.
      </div>
    )
  }

  if (!hasResultData && hasPipelineContext) {
    return (
      <div className="rounded-xl px-2 py-4 sm:px-4 sm:py-6" role="region" aria-label="분석 진행">
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
    <div id="analysis-live-region" className="dm-analytics-page rounded-xl px-1 py-3 sm:px-2 sm:py-4 overflow-visible" role="region" aria-label="분석 결과 대시보드">
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
            <div className={cn('min-w-0', depthLayout === 'fast' ? 'space-y-8' : 'space-y-10')}>
              <section id="summary-section" className={cn(sectionScrollClass, 'mb-10')}>
                <div className={sectionCardClass}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-base font-bold text-gray-900">종합 요약</h2>
                    <div className="flex items-center gap-2">
                      {allCompleted && analysisDepth ? <AnalysisDepthQualityBadge depth={depthLayout} /> : null}
                      <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                    </div>
                  </div>
                  <AnalysisMetaRow keyword={keyword} countryCode={countryCode} updatedAt={effectiveResult?.updated_at ?? null} className="mb-4 px-0.5" />
                  <ResultSummaryCards result={effectiveResult ?? null} consensusData={consensusData} taskData={taskData} analysisTasks={analysisTasks ?? undefined} loading={loading} variant="saas" />
                </div>
              </section>

              <SectionShell id="market-section" title="시장 분석" badge="시장" icon={BarChart3} source={<AnalysisSourceButton result={effectiveResult ?? null} label="출처" />}>
                <div className={sectionCardClass}>
                  <OpportunityScoreBreakdown embedded score={effectiveResult?.key_metrics?.opportunity_score ?? null} loading={loading} stableScore={stableOppScore} analysisFailed={analysisFailed} breakdown={effectiveResult?.key_metrics?.opportunity_score_breakdown} useKoreanLabels />
                </div>
                <div className={sectionCardClass}>
                  <AnalysisResultSections result={result} taskData={taskData} analysisTasks={analysisTasks} consensusData={consensusData} loading={loading} keyword={keyword} layout="pm-analytics" sectionOnly="market-trends" />
                </div>
              </SectionShell>

              <SectionShell id="competitor-section" title="경쟁사 분석" badge="경쟁" icon={Users} source={<AnalysisSourceButton result={effectiveResult ?? null} label="출처" />}>
                <div className={sectionCardClass}>
                  <AnalysisResultSections result={result} taskData={taskData} analysisTasks={analysisTasks} consensusData={consensusData} loading={loading} keyword={keyword} layout="pm-analytics" sectionOnly="competition" />
                </div>
              </SectionShell>

              <SectionShell id="insight-strategy-section" title="인사이트 · 전략" badge="전략" icon={Lightbulb} source={<AnalysisSourceButton result={effectiveResult ?? null} label="출처" />}>
                <div className={sectionCardClass}>
                  <InsightStrategyTabsPanel result={effectiveResult ?? null} taskData={taskData} analysisTasks={analysisTasks} newsList={newsList} consensusData={consensusData} loading={loading} />
                </div>
                <div className={sectionCardClass}>
                  <AnalysisResultSections result={result} taskData={taskData} analysisTasks={analysisTasks} consensusData={consensusData} loading={loading} keyword={keyword} layout="pm-analytics" sectionOnly="strategic" strategicOmitFrameworks />
                </div>
              </SectionShell>

              <SectionShell id="action-section" title="PM 액션 플랜" badge="실행" icon={CheckSquare} source={allCompleted && analysisDepth ? <AnalysisDepthQualityBadge depth={depthLayout} /> : null}>
                <div className={sectionCardClass}>
                  <PmActionPlanSection result={effectiveResult ?? null} taskData={taskData} analysisTasks={analysisTasks} consensusData={consensusData} loading={loading} keyword={keyword} onRetryExecutionLayer={() => handleRetryPipelineStep('execution_layer')} />
                </div>
              </SectionShell>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionShell({
  id,
  title,
  badge,
  icon: Icon,
  source,
  children,
}: {
  id: string
  title: string
  badge: string
  icon: typeof BarChart3
  source?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn(sectionScrollClass, 'mb-10')}>
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
            <Icon className="h-4 w-4 text-blue-600" />
          </div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">{badge}</span>
        <div className="h-px flex-1 bg-gray-100" />
        {source ? (
          <span className="inline-flex items-center gap-1 text-xs text-gray-400">
            <ExternalLink className="h-3 w-3" />
            {source}
          </span>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
