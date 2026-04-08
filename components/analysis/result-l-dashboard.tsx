'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

type TabValue = 'insight' | 'action'

type ResultLDashboardProps = ResultPageStructuredSectionsProps & {
  countryCode?: string
  aiPrimaryModel?: 'gemini' | 'groq'
  phaseRerunDisabled?: boolean
}

/**
 * L자형 분석 대시보드: 좌측 요약·긴급 과제, 우측 Insight(요약+차트+심층) / Action(실행 테이블) 2탭.
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
}: ResultLDashboardProps) {
  const effectiveResult = displayResult ?? result
  const hasResultData = !!(effectiveResult?.reportId ?? effectiveResult?.key_metrics)
  const [tab, setTab] = useState<TabValue>('insight')
  const reportId = effectiveResult?.reportId ?? null
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

  const goTab = (t: TabValue) => setTab(t)

  const km = effectiveResult?.key_metrics
  const scoreRationale =
    sanitizeForKoreanDisplay(
      km?.strategic_decision_layer?.market_opportunity_explanation ?? km?.opportunity_score_reasoning
    )?.trim() || null
  const conclusionFull =
    sanitizeForKoreanDisplay(km?.summary_insights)?.trim() || '핵심 전략 방향을 분석 완료 후 확인할 수 있습니다.'

  if (!hasResultData) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
        결과 요약 데이터가 없습니다. 분석이 완료되면 L자형 리포트가 표시됩니다.
      </div>
    )
  }

  return (
    <div
      className={cn(analysisPageBg, 'rounded-xl px-2 py-4 sm:px-4 sm:py-6')}
      role="region"
      aria-label="분석 결과 대시보드"
    >
      <Tabs value={tab} onValueChange={(v) => goTab(v as TabValue)} className="w-full">
        <div className="mx-auto flex w-full flex-col gap-8 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start lg:gap-10 xl:gap-12">
          <MotionReveal
            key={`rail-${reportId ?? 'x'}`}
            staticLayout={loading}
            className="min-w-0"
            delay={0}
          >
            <ResultLeftRail
              effectiveResult={effectiveResult ?? null}
              taskData={taskData}
              analysisTasks={analysisTasks ?? undefined}
              loading={loading}
              onNavigateTab={(t) => goTab(t === 'action' ? 'action' : 'insight')}
              stableOpportunityScore={stableOppScore}
              analysisFailed={analysisFailed}
              scoreRationaleSummary={scoreRationale}
              conclusionFull={conclusionFull}
            />
          </MotionReveal>

          <MotionReveal
            key={`main-${reportId ?? 'x'}`}
            staticLayout={loading}
            className="min-w-0 space-y-8"
            delay={0.06}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <TabsList
                className={cn(
                  'sticky top-14 z-20 flex h-auto w-full min-w-0 flex-1 flex-wrap justify-stretch gap-1 rounded-xl border border-slate-200/90 bg-white p-1.5 shadow-sm',
                  'dark:border-zinc-700 dark:bg-zinc-900 lg:top-20 sm:max-w-[min(100%,28rem)]'
                )}
              >
                <TabsTrigger
                  value="insight"
                  className="flex-1 min-w-[120px] rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-emerald-200/80 dark:text-zinc-400 dark:data-[state=active]:bg-emerald-950/50 dark:data-[state=active]:text-emerald-100 dark:data-[state=active]:ring-emerald-800/60"
                >
                  Insight
                </TabsTrigger>
                <TabsTrigger
                  value="action"
                  className="flex-1 min-w-[120px] rounded-lg px-4 py-3 text-sm font-semibold text-slate-600 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-900 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-emerald-200/80 dark:text-zinc-400 dark:data-[state=active]:bg-emerald-950/50 dark:data-[state=active]:text-emerald-100 dark:data-[state=active]:ring-emerald-800/60"
                >
                  Action
                </TabsTrigger>
              </TabsList>
              {keyword.trim() ? (
                <AnalysisPhaseRerunIcons
                  keyword={keyword}
                  countryCode={countryCode}
                  aiPrimaryModel={aiPrimaryModel}
                  disabled={phaseRerunDisabled}
                  className="shrink-0"
                />
              ) : null}
            </div>

            <TabsContent value="insight" className="mt-0 space-y-8 focus-visible:outline-none" id="tab-insight">
              <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 motion-safe:will-change-transform">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4 dark:border-zinc-800">
                  <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">요약 · 기회 점수</h3>
                  <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                </div>
                <div className="space-y-8">
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
                  <StrategicDecisionLayer result={effectiveResult ?? null} loading={loading} keyword={keyword} embedded />
                  <StrategyEvaluationSection result={effectiveResult ?? null} loading={loading} />
                </div>
              </div>
              <InsightSectionShell title="시장 트렌드 · 수요 신호" result={effectiveResult ?? null} loading={loading} animationIndex={0}>
                <AnalysisResultSections
                  result={result}
                  taskData={taskData}
                  analysisTasks={analysisTasks}
                  consensusData={consensusData}
                  loading={loading}
                  keyword={keyword}
                  layout="pm-analytics"
                  sectionOnly="market-trends"
                />
              </InsightSectionShell>
              <InsightSectionShell title="경쟁 환경 · 포지셔닝" result={effectiveResult ?? null} loading={loading} animationIndex={1}>
                <AnalysisResultSections
                  result={result}
                  taskData={taskData}
                  analysisTasks={analysisTasks}
                  consensusData={consensusData}
                  loading={loading}
                  keyword={keyword}
                  layout="pm-analytics"
                  sectionOnly="competition"
                />
              </InsightSectionShell>
              <InsightSectionShell title="핵심 인사이트" result={effectiveResult ?? null} loading={loading} animationIndex={2}>
                <KeyMarketInsightsCard
                  result={effectiveResult ?? null}
                  taskData={taskData}
                  analysisTasks={analysisTasks}
                  newsList={newsList}
                  consensusData={consensusData}
                  loading={loading}
                  keyword={keyword}
                />
              </InsightSectionShell>
              <InsightSectionShell title="GTM · 시장 선점 시나리오" result={effectiveResult ?? null} loading={loading} animationIndex={3}>
                <AnalysisResultSections
                  result={result}
                  taskData={taskData}
                  analysisTasks={analysisTasks}
                  consensusData={consensusData}
                  loading={loading}
                  keyword={keyword}
                  layout="pm-analytics"
                  sectionOnly="strategic"
                />
              </InsightSectionShell>
            </TabsContent>

            <TabsContent value="action" className="mt-0 space-y-6 focus-visible:outline-none" id="tab-action">
              <p className="text-sm text-slate-500 dark:text-zinc-400 leading-relaxed">
                상태는 이 브라우저에만 저장됩니다. 실행 과제를 배포·공유할 때는 별도 워크플로에 반영하세요.
              </p>
              <StrategyExecutionTable
                result={effectiveResult ?? null}
                taskData={taskData}
                analysisTasks={analysisTasks}
                loading={loading}
                keyword={keyword}
              />
            </TabsContent>
          </MotionReveal>
        </div>
      </Tabs>
    </div>
  )
}

function InsightSectionShell({
  title,
  result,
  children,
  loading = false,
  animationIndex = 0,
}: {
  title: string
  result: ResearchResponse | null
  children: ReactNode
  loading?: boolean
  animationIndex?: number
}) {
  return (
    <MotionReveal staticLayout={loading} delay={0.08 + animationIndex * 0.05}>
      <section className="rounded-xl border border-slate-100 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
          <h3 className="text-base font-semibold tracking-tight text-slate-900 dark:text-zinc-50">{title}</h3>
          <AnalysisSourceButton result={result} label="출처" />
        </div>
        <div className="p-5">{children}</div>
      </section>
    </MotionReveal>
  )
}
