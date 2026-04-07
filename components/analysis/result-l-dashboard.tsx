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

type TabValue = 'insight' | 'action'

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
}: ResultPageStructuredSectionsProps) {
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
      <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-white px-6 py-12 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
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
        <div className="mx-auto flex w-full flex-col gap-6 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start lg:gap-8">
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

          <div className="min-w-0 space-y-4">
            <TabsList
              className={cn(
                'sticky top-14 z-20 flex h-auto w-full flex-wrap justify-stretch gap-1 rounded-xl border border-[#E8EAED] bg-white p-1.5 shadow-sm',
                'dark:border-zinc-700 dark:bg-zinc-900 lg:top-20'
              )}
            >
              <TabsTrigger
                value="insight"
                className="flex-1 min-w-[120px] rounded-lg px-4 py-3 text-sm font-bold data-[state=active]:bg-[#E8FAF9] data-[state=active]:text-[#222] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-[#2AC1BC]/30 dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-zinc-50"
              >
                Insight
              </TabsTrigger>
              <TabsTrigger
                value="action"
                className="flex-1 min-w-[120px] rounded-lg px-4 py-3 text-sm font-bold data-[state=active]:bg-[#E8FAF9] data-[state=active]:text-[#222] data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-[#2AC1BC]/30 dark:data-[state=active]:bg-zinc-800 dark:data-[state=active]:text-zinc-50"
              >
                Action
              </TabsTrigger>
            </TabsList>

            <TabsContent value="insight" className="mt-0 space-y-6 focus-visible:outline-none" id="tab-insight">
              <div className="rounded-xl border border-[#E8EAED] bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#E8EAED] pb-3 dark:border-zinc-800">
                  <h3 className="text-sm font-bold text-[#222] dark:text-zinc-50">요약 · 기회 점수</h3>
                  <AnalysisSourceButton result={effectiveResult ?? null} label="출처" />
                </div>
                <div className="space-y-6">
                  <OpportunityScoreBreakdown
                    score={effectiveResult?.key_metrics?.opportunity_score ?? null}
                    loading={loading}
                    stableScore={stableOppScore}
                    analysisFailed={analysisFailed}
                    breakdown={effectiveResult?.key_metrics?.opportunity_score_breakdown}
                    useKoreanLabels
                    className="border-[#E8EAED] bg-white dark:border-zinc-700 dark:bg-zinc-900"
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
              <InsightSectionShell title="시장 트렌드 · 수요 신호" result={effectiveResult ?? null}>
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
              <InsightSectionShell title="경쟁 환경 · 포지셔닝" result={effectiveResult ?? null}>
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
              <InsightSectionShell title="핵심 인사이트" result={effectiveResult ?? null}>
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
              <InsightSectionShell title="GTM · 시장 선점 시나리오" result={effectiveResult ?? null}>
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

            <TabsContent value="action" className="mt-0 space-y-4 focus-visible:outline-none" id="tab-action">
              <p className="text-xs text-slate-500 dark:text-zinc-400">
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
          </div>
        </div>
      </Tabs>
    </div>
  )
}

function InsightSectionShell({
  title,
  result,
  children,
}: {
  title: string
  result: ResearchResponse | null
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{title}</h3>
        <AnalysisSourceButton result={result} label="출처" />
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}
