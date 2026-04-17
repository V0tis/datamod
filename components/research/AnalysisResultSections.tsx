'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Users,
  Lightbulb,
  Target,
  TrendingUp,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react'
import { ProductStrategySection } from '@/components/research/ProductStrategySection'
import { StrategyFrameworkPanel } from '@/components/research/StrategyFrameworkPanel'
import { AnalysisCharts } from '@/components/research/AnalysisCharts'
import { MarketGrowthCharts } from '@/components/research/MarketGrowthCharts'
import { CompetitorLandscapeTable } from '@/components/research/CompetitorLandscapeTable'
import { StartupConceptCard } from '@/components/research/StartupConceptCard'
import { KeyInsightBulletCard } from '@/components/research/KeyInsightBulletCard'
import { QuickActions } from '@/components/research/QuickActions'
import { StrategicActionsSection, type StrategicActionItem } from '@/components/research/StrategicActionsSection'
import { textToBullets } from '@/lib/text-to-bullets'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { StreamingBulletList, StreamingRiskList } from '@/components/research/StreamingInsightText'
import { CompetitorBubbleQuadrant } from '@/components/research/CompetitorBubbleQuadrant'
import { StrategicActionPlanSection } from '@/components/research/StrategicActionPlanSection'
import { RiskSignalsSeverityList } from '@/components/research/RiskSignalsSeverityList'
import { normalizeRiskSignalsFromParse } from '@/lib/ai/pipeline-prompts'
import { MarkdownBody } from '@/components/ui/markdown-body'
import { cn } from '@/lib/utils'
import { ExpandableText } from '@/components/ui/expandable-text'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { DEFAULT_KEY_METRICS_LOADING } from '@/lib/research-defaults'
import { motionConfig } from '@/lib/motion-config'
import { sanitizeStringArray, sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import type { SectionStatus } from '@/components/research/ProductStrategySection'

type TaskOutput = Record<string, unknown>
type AnalysisTask = {
  step_name: string
  status: string
  output_data: unknown
}

function getTaskOutput(
  step: string,
  taskData: Partial<Record<string, unknown>>,
  analysisTasks: AnalysisTask[] | null | undefined
): TaskOutput | null {
  const task = analysisTasks?.find((t) => t.step_name === step)
  const raw = (task?.output_data && typeof task.output_data === 'object'
    ? task.output_data
    : taskData[step]) as TaskOutput | null
  return raw && typeof raw === 'object' ? raw : null
}

function getSectionStatus(
  stepName: string,
  analysisTasks: AnalysisTask[] | null | undefined,
  loading: boolean
): SectionStatus | undefined {
  const task = analysisTasks?.find((t) => t.step_name === stepName)
  if (task) {
    const s = task.status as SectionStatus
    if (s === 'pending' || s === 'running' || s === 'completed' || s === 'failed') return s
  }
  if (!loading && (!analysisTasks?.length || !task)) return undefined
  const order = ['signal_layer', 'trend_analysis', 'competition_analysis', 'insight_extraction', 'strategy_generation', 'execution_layer']
  const idx = order.indexOf(stepName)
  if (idx < 0) return undefined
  const runningNow = analysisTasks?.find((t) => t.step_name === stepName && t.status === 'running')
  if (runningNow) return 'running'
  if (task?.status === 'completed') return 'completed'
  if (task?.status === 'failed') return 'failed'
  const prevCompleted = order.slice(0, idx).every((prev) =>
    analysisTasks?.some((t) => t.step_name === prev && t.status === 'completed')
  )
  if (prevCompleted && loading) return 'pending'
  return 'pending'
}

function EvidenceChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] leading-snug text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
      {children}
    </span>
  )
}

function MarketSizeEvidenceCard({
  loading,
  score,
  reasoning,
  newsCount,
}: {
  loading: boolean
  score: number | null
  reasoning?: string
  newsCount: number
}) {
  const r = reasoning?.replace(/\s+/g, ' ').trim()
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-6 shadow-none dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">시장 규모</p>
      <p className="text-xl font-semibold tabular-nums text-foreground">
        {loading ? '산출 중...' : score != null ? `${score}/100` : '—'}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">시장 매력도</p>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">왜 이 점수인가?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {r ? (
          <EvidenceChip>
            {r.length > 110 ? `${r.slice(0, 110).trim()}…` : r}
          </EvidenceChip>
        ) : (
          !loading && <EvidenceChip>통합 리서치·RSS·검색 시그널을 종합한 매력도입니다.</EvidenceChip>
        )}
        {newsCount > 0 ? <EvidenceChip>뉴스·언급 시그널 {newsCount}건 반영</EvidenceChip> : null}
      </div>
    </div>
  )
}

function GrowthPotentialEvidenceCard({
  marketGrowth,
  trendMomentum,
  growthSignalCount,
  trendSummary,
}: {
  marketGrowth: number | null
  trendMomentum: number | null
  growthSignalCount: number
  trendSummary?: string
}) {
  const mg = marketGrowth ?? null
  const tm = trendMomentum ?? null
  const display = mg ?? tm ?? null
  return (
    <div className="rounded-lg border border-slate-100 bg-white p-6 shadow-none dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">성장 잠재력</p>
      <p className="text-xl font-semibold tabular-nums text-foreground">{display != null ? `${display}/100` : '—'}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">성장·트렌드 잠재력</p>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">왜 이 점수인가?</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mg != null ? <EvidenceChip>시장 성장 지표 {mg}점</EvidenceChip> : null}
        {tm != null ? <EvidenceChip>검색·트렌드 모멘텀 {tm}점</EvidenceChip> : null}
        {growthSignalCount > 0 ? <EvidenceChip>성장 시그널 {growthSignalCount}개 추출</EvidenceChip> : null}
        {trendSummary ? (
          <EvidenceChip>{trendSummary.length > 100 ? `${trendSummary.slice(0, 100)}…` : trendSummary}</EvidenceChip>
        ) : null}
      </div>
    </div>
  )
}

export type AnalysisResultLayout = 'default' | 'pm-analytics'

export interface AnalysisResultSectionsProps {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: AnalysisTask[] | null
  consensusData?: {
    sentiment?: { score?: number; trend?: 'rising' | 'falling' | 'stable'; ratio?: unknown }
    strategicSummary?: { summary?: string; opportunity?: string; actionItems?: string[] }
  } | null
  loading?: boolean
  keyword?: string
  onSaveToWorkspace?: () => void
  /** PM 분석 도구 레이아웃: 섹션 순서 변경, 리스크 평가 추가 */
  layout?: AnalysisResultLayout
  /** When set, render only this section's content (for structured collapsible layout) */
  sectionOnly?: 'market-trends' | 'competition' | 'strategic' | 'action'
}

export function AnalysisResultSections({
  result,
  taskData = {},
  analysisTasks = null,
  consensusData,
  loading = false,
  keyword = '',
  onSaveToWorkspace,
  layout = 'default',
  sectionOnly,
}: AnalysisResultSectionsProps) {
  /** 분석 중에도 차트/기회점수 표시: key_metrics 없으면 default 사용 */
  const km = result?.key_metrics ?? (loading ? DEFAULT_KEY_METRICS_LOADING : {})
  const signalOutput = getTaskOutput('signal_layer', taskData, analysisTasks)
  const trendOutput = getTaskOutput('trend_analysis', taskData, analysisTasks)
  const competitionOutput = getTaskOutput('competition_analysis', taskData, analysisTasks)
  const insightOutput = getTaskOutput('insight_extraction', taskData, analysisTasks)
  const strategyOutput = getTaskOutput('strategy_generation', taskData, analysisTasks)
  const executionOutput = getTaskOutput('execution_layer', taskData, analysisTasks)

  // Market Opportunity
  const opportunityScore = typeof km.opportunity_score === 'number' ? km.opportunity_score : null
  const breakdown = km.opportunity_score_breakdown ?? {}
  const opportunityScoreSummaryLine =
    (typeof km.opportunity_score_summary_text === 'string' && km.opportunity_score_summary_text.trim()) ||
    (typeof km.opportunity_score_reasoning === 'string' && km.opportunity_score_reasoning.trim()) ||
    undefined
  const opportunityScoreReasonNarrative =
    (typeof km.opportunity_score_reason_text === 'string' && km.opportunity_score_reason_text.trim()) ||
    (typeof km.strategic_decision_layer?.market_opportunity_explanation === 'string' &&
      km.strategic_decision_layer.market_opportunity_explanation.trim()) ||
    undefined
  const opportunityScoreChartDialogText =
    [opportunityScoreReasonNarrative, opportunityScoreSummaryLine].filter(Boolean).join('\n\n') || undefined
  const marketGrowth = typeof breakdown.market_growth === 'number' ? breakdown.market_growth : null
  const trendMomentum = typeof breakdown.trend_momentum === 'number' ? breakdown.trend_momentum : null
  const growthSignals = Array.isArray(trendOutput?.growth_signals)
    ? (trendOutput.growth_signals as string[]).filter((s) => typeof s === 'string').slice(0, 5)
    : []
  const keyTrends = sanitizeStringArray([
    ...growthSignals,
    ...(km.positive_signals ?? []).slice(0, 3),
  ]).slice(0, 5)

  // Key Insights (Top 3)
  const valueProposition = sanitizeForKoreanDisplay(consensusData?.strategicSummary?.opportunity) || ''
  const opportunities = sanitizeStringArray(
    Array.isArray(strategyOutput?.opportunities)
      ? (strategyOutput.opportunities as string[]).filter((s) => typeof s === 'string')
      : km.positive_signals ?? result?.marketNews ?? []
  )
  const keyConclusions = sanitizeStringArray(result?.keyConclusions ?? (km.keyConclusions as string[] | undefined) ?? [])
  const summaryInsights = sanitizeForKoreanDisplay(km.summary_insights) || ''
  const strategySummary = sanitizeForKoreanDisplay(
    typeof strategyOutput?.strategy_summary === 'string' ? strategyOutput.strategy_summary : ''
  ) || ''

  const topInsights = [
    valueProposition,
    opportunities[0],
    keyConclusions[0],
    summaryInsights,
    strategySummary,
  ].filter((s) => s && s.length > 0).slice(0, 3)

  // Competitive Landscape (task output or key_metrics fallback for cached/history)
  const competitiveLandscape = Array.isArray(competitionOutput?.competitive_landscape)
    ? (competitionOutput.competitive_landscape as Array<{
        name?: string
        positioning?: string
        target_market?: string
        market_presence?: number
        innovation_level?: number
        key_feature?: string
        pricing?: string
        differentiation?: string
        competitor_gap?: string
        our_differentiation?: string
        strength?: string
        weakness?: string
        score_rationale?: string
      }>)
    : Array.isArray(km.competitive_landscape)
      ? (km.competitive_landscape as Array<{
          name?: string
          positioning?: string
          target_market?: string
          market_presence?: number
          innovation_level?: number
          key_feature?: string
          pricing?: string
          differentiation?: string
          competitor_gap?: string
          our_differentiation?: string
          score_rationale?: string
        }>)
      : []

  const strategicGaps =
    (competitionOutput?.strategic_gaps as
      | { functional?: string[]; pricing?: string[]; summary?: string }
      | undefined) ?? km.strategic_gaps
  const pmPlanningSummary =
    (typeof competitionOutput?.pm_planning_summary === 'string' ? competitionOutput.pm_planning_summary : undefined) ??
    (typeof km.pm_planning_summary === 'string' ? km.pm_planning_summary : undefined)
  const strategicActionPlan =
    (competitionOutput?.strategic_action_plan as
      | { roadmap_priorities?: Array<{ title: string; rationale?: string; priority_rank?: number }>; okr_key_results?: Array<{ objective?: string; key_results?: string[] }> }
      | undefined) ?? km.strategic_action_plan
  const competitorTrendsBullets = textToBullets(result?.competitorTrends ?? '', 4)
  const marketStructureBullets = textToBullets(
    typeof competitionOutput?.market_structure === 'string' ? competitionOutput.market_structure : '',
    3
  )

  // Strategy Recommendation
  const strategyBullets = textToBullets(
    (strategySummary || summaryInsights || consensusData?.strategicSummary?.summary) ?? '',
    4
  )
  const opportunityReason = valueProposition || strategyBullets[0] || ''

  // Execution Ideas
  const pmActions = km.pm_actions?.recommended_actions ?? []
  const actionItems = pmActions
    .map((a) => (a?.title ?? (a as { action?: string })?.action ?? ''))
    .filter(Boolean)
  const actionItemsFromConsensus = consensusData?.strategicSummary?.actionItems ?? []
  const allActionItems = [...actionItems, ...actionItemsFromConsensus].filter(Boolean).slice(0, 8)
  const mvpIdeas = opportunities.slice(0, 3)
  const productIdea = typeof executionOutput?.product_idea === 'string' ? executionOutput.product_idea : undefined
  const targetCustomer = typeof executionOutput?.target_customer === 'string' ? executionOutput.target_customer : undefined
  const monetization = typeof executionOutput?.monetization === 'string' ? executionOutput.monetization : undefined
  const goToMarketSteps = Array.isArray(executionOutput?.go_to_market_steps)
    ? (executionOutput.go_to_market_steps as string[]).filter((s): s is string => typeof s === 'string')
    : []

  // Strategy frameworks (SWOT, JTBD, Porter 5 Forces) - from km or execution output
  const swot = km.swot_analysis ?? (executionOutput?.swot_analysis as typeof km.swot_analysis)
  const jtbd = km.jtbd ?? (executionOutput?.jtbd as typeof km.jtbd)
  const porter5 = km.porter_5_forces ?? (executionOutput?.porter_5_forces as typeof km.porter_5_forces)
  const porterBulletTotal =
    (porter5?.rivalry?.length ?? 0) +
    (porter5?.supplier_power?.length ?? 0) +
    (porter5?.buyer_power?.length ?? 0) +
    (porter5?.substitutes?.length ?? 0) +
    (porter5?.new_entrants?.length ?? 0)
  const hasPorterScores =
    porter5?.scores != null &&
    Object.values(porter5.scores).some((v) => typeof v === 'number' && !Number.isNaN(v))
  const hasFrameworks =
    (swot &&
      (swot.strengths?.length ||
        swot.weaknesses?.length ||
        swot.opportunities?.length ||
        swot.threats?.length)) ||
    (jtbd &&
      (jtbd.main_jobs?.length ||
        jtbd.pains?.length ||
        jtbd.gains?.length ||
        jtbd.functional_jobs?.length ||
        jtbd.social_jobs?.length ||
        jtbd.emotional_jobs?.length)) ||
    (porter5 != null && (porterBulletTotal > 0 || hasPorterScores)) ||
    opportunityScore != null
  const frameworkPanelKey = `${result?.reportId ?? 'live'}:${keyword}`

  // Strategic Actions for existing component
  const risks = sanitizeStringArray(
    Array.isArray(strategyOutput?.risks)
      ? (strategyOutput.risks as string[]).filter((s): s is string => typeof s === 'string')
      : (km.negative_risks ?? result?.painPoints ?? [])
  )

  const riskSignalItems = normalizeRiskSignalsFromParse(
    Array.isArray(insightOutput?.risk_signals)
      ? (insightOutput.risk_signals as unknown[])
      : Array.isArray(km.risk_signals)
        ? (km.risk_signals as unknown[])
        : []
  )

  const strategicActions: StrategicActionItem[] = pmActions
    .map((a, i) => {
      const title = a?.title ?? (a as { action?: string })?.action ?? ''
      const reasoning = typeof (a as { reasoning?: string })?.reasoning === 'string'
        ? (a as { reasoning: string }).reasoning.trim()
        : ''
      const relatedRisk = typeof (a as { related_risk?: string })?.related_risk === 'string'
        ? (a as { related_risk: string }).related_risk.trim()
        : ''
      const desc = relatedRisk ? `대상 리스크: ${relatedRisk}. ${reasoning}`.trim() : reasoning || '시장 분석이 이 방향을 뒷받침합니다.'
      const opp = opportunities[i] || reasoning || `${title || '이 영역'}에 집중하는 제품 이니셔티브.`
      return {
        id: `action-${i}-${(title || '').slice(0, 30).replace(/\s+/g, '-')}`,
        title: title || `액션 ${i + 1}`,
        description: desc,
        opportunity: opp !== desc ? opp : `다음 기회를 해결하는 제품 구축: ${title || '이 기회'}.`,
      }
    })
    .filter((a) => a.title && (a.description || a.opportunity))

  const keyInsightRaw = topInsights[0] || ''
  const keyInsight = keyInsightRaw

  const getMarkdownContent = () => {
    const lines: string[] = []
    lines.push(`# 시장 분석: ${keyword || '인사이트'}`)
    lines.push('')
    if (keyInsightRaw) {
      lines.push('## 핵심 인사이트')
      lines.push('')
      lines.push(keyInsightRaw)
      lines.push('')
    }
    lines.push('## 시장 기회')
    if (opportunityScore != null) lines.push(`- 시장 규모/기회 점수: ${opportunityScore}/100`)
    if (marketGrowth != null) lines.push(`- Growth: ${marketGrowth}/100`)
    keyTrends.forEach((t) => lines.push(`- ${t}`))
    lines.push('')
    lines.push('## 핵심 인사이트')
    topInsights.forEach((i) => lines.push(`- ${i}`))
    lines.push('')
    lines.push('## 경쟁 환경')
    competitiveLandscape.forEach((c) => lines.push(`- **${c.name}**${c.positioning ? ` · ${c.positioning}` : ''}`))
    if (competitorTrendsBullets.length > 0) competitorTrendsBullets.forEach((b) => lines.push(`- ${b}`))
    lines.push('')
    lines.push('## 전략 추천')
    strategyBullets.forEach((b) => lines.push(`- ${b}`))
    if (opportunityReason) lines.push('', `**이 기회가 존재하는 이유:** ${opportunityReason}`)
    lines.push('')
    lines.push('## 실행 아이디어')
    allActionItems.forEach((a) => lines.push(`- ${a}`))
    mvpIdeas.forEach((m) => lines.push(`- MVP: ${m}`))
    return lines.join('\n')
  }

  const hasAnyContent =
    opportunityScore != null ||
    keyTrends.length > 0 ||
    topInsights.length > 0 ||
    competitiveLandscape.length > 0 ||
    competitorTrendsBullets.length > 0 ||
    marketStructureBullets.length > 0 ||
    strategyBullets.length > 0 ||
    allActionItems.length > 0 ||
    strategicActions.length > 0 ||
    riskSignalItems.length > 0 ||
    !!hasFrameworks

  const isPmAnalytics = layout === 'pm-analytics'
  const showProgressiveSections = isPmAnalytics && (loading || (analysisTasks?.length ?? 0) > 0 || result != null)
  if (!hasAnyContent && !loading && !showProgressiveSections) return null

  /** For sectionOnly mode: render only the requested block (content only, no ProductStrategySection) */
  const renderMarketTrends = () => (
    <>
      {(loading && !opportunityScore && keyTrends.length === 0 && Object.keys(breakdown).length === 0) ? (
        <SectionContentSkeleton variant="grid" />
      ) : (
        <div className="space-y-6">
          <MarketGrowthCharts
            opportunityScore={opportunityScore ?? undefined}
            breakdown={breakdown}
            growthSignalsCount={growthSignals.length}
            marketTemperatureScore={typeof trendOutput?.market_temperature_score === 'number' ? trendOutput.market_temperature_score : km.market_temperature_score ?? undefined}
            chartInsights={km.chart_insights}
            opportunityScoreReasoning={opportunityScoreChartDialogText}
            keyword={keyword}
            radarSkeleton={loading && opportunityScore == null && keyTrends.length === 0}
          />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-8 lg:grid-cols-3">
            {(opportunityScore != null || loading) && (
              <MarketSizeEvidenceCard
                loading={loading && opportunityScore == null}
                score={opportunityScore}
                reasoning={opportunityScoreSummaryLine}
                newsCount={
                  Array.isArray(signalOutput?.news_activity) ? (signalOutput.news_activity as unknown[]).length : 0
                }
              />
            )}
            {(marketGrowth != null || trendMomentum != null) && (
              <GrowthPotentialEvidenceCard
                marketGrowth={marketGrowth}
                trendMomentum={trendMomentum}
                growthSignalCount={growthSignals.length}
                trendSummary={
                  typeof trendOutput?.trend_summary === 'string' ? trendOutput.trend_summary.slice(0, 120) : undefined
                }
              />
            )}
          </div>
          <AnalysisCharts
            opportunityScoreBreakdown={Object.keys(breakdown).length > 0 ? breakdown : undefined}
            chartInsights={km.chart_insights}
            className="mb-4"
          />
          {keyTrends.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">핵심 트렌드</p>
              <StreamingBulletList items={keyTrends} streaming={loading} skipAnimation={!loading} revealDelayMs={320} />
            </div>
          )}
          {!opportunityScore && keyTrends.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </div>
      )}
    </>
  )

  const renderCompetition = () => (
    <>
      {loading && competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 ? (
        <SectionContentSkeleton variant="mixed" />
      ) : (
        <div className="space-y-4">
          {competitiveLandscape.length > 0 && (
            <>
              <CompetitorLandscapeTable competitors={competitiveLandscape} loading={loading} />
              <CompetitorBubbleQuadrant
                competitors={competitiveLandscape}
                pmCaption={
                  layout === 'pm-analytics' && competitiveLandscape.length > 0
                    ? `${competitiveLandscape.length}개 주체 기준 상대 점유·성장성을 읽고, 호버로 좌표 근거를 확인하세요.`
                    : null
                }
              />
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">주요 경쟁사</p>
                <div className="flex flex-wrap gap-2">
                  {competitiveLandscape.slice(0, 8).map((c, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.positioning && <span className="text-muted-foreground text-xs ml-1">· {c.positioning}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          {(competitorTrendsBullets.length > 0 || marketStructureBullets.length > 0) && (
            <div>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">시장 포지셔닝</p>
              <StreamingBulletList items={competitorTrendsBullets.length > 0 ? competitorTrendsBullets : marketStructureBullets} streaming={loading} skipAnimation={!loading} revealDelayMs={280} />
            </div>
          )}
          {competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 && marketStructureBullets.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">경쟁 구도 데이터가 없습니다.</p>
          )}
        </div>
      )}
    </>
  )

  if (sectionOnly === 'market-trends') return <div className="animate-in fade-in duration-300">{renderMarketTrends()}</div>
  if (sectionOnly === 'competition') return <div className="animate-in fade-in duration-300">{renderCompetition()}</div>

  /** sectionOnly="strategic": frameworks + risks + strategy only (for Structured layout) */
  if (sectionOnly === 'strategic') {
    return (
      <div className="space-y-10 animate-in fade-in duration-300">
        {(hasFrameworks || loading) && (
          <ProductStrategySection
            title="제품 전략 프레임워크"
            icon={<LayoutGrid className="h-5 w-5" />}
            status={getSectionStatus('execution_layer', analysisTasks, loading)}
            loading={loading}
            streamingComplete={!loading && !!hasFrameworks}
            variant="flat"
          >
            {loading && !hasFrameworks ? (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-8">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                    <div className="h-4 w-24 rounded bg-muted/50 animate-pulse mb-3" />
                    <div className="space-y-2">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="h-3 rounded bg-muted/30 animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <StrategyFrameworkPanel
                instanceKey={frameworkPanelKey}
                swot={swot}
                jtbd={jtbd}
                porter={porter5}
                opportunityBreakdown={breakdown}
                strategicDecisionLayer={km.strategic_decision_layer}
                strategyEvaluation={km.strategy_evaluation}
                className="p-6 sm:p-6"
              />
            )}
          </ProductStrategySection>
        )}
        <ProductStrategySection
          title="리스크 평가"
          icon={<AlertTriangle className="h-5 w-5" />}
          status={getSectionStatus('strategy_generation', analysisTasks, loading)}
          loading={loading}
          streamingComplete={!loading && (risks.length > 0 || riskSignalItems.length > 0)}
          variant="flat"
        >
          {loading && risks.length === 0 && riskSignalItems.length === 0 ? (
            <SectionContentSkeleton variant="list" />
          ) : riskSignalItems.length > 0 ? (
            <div className="space-y-4">
              <RiskSignalsSeverityList items={riskSignalItems} maxItems={8} />
              {risks.length > 0 ? (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">전략 단계 요약 리스크</p>
                  <StreamingRiskList items={risks.slice(0, 5)} streaming={loading} skipAnimation={!loading} revealDelayMs={300} />
                </div>
              ) : null}
            </div>
          ) : risks.length > 0 ? (
            <StreamingRiskList items={risks.slice(0, 5)} streaming={loading} skipAnimation={!loading} revealDelayMs={300} />
          ) : (
            <p className="text-sm text-muted-foreground">리스크 데이터가 없습니다.</p>
          )}
        </ProductStrategySection>
        <ProductStrategySection
          title="제품 전략 제안"
          icon={<Target className="h-5 w-5" />}
          status={getSectionStatus('execution_layer', analysisTasks, loading)}
          loading={loading}
          streamingComplete={!loading && (strategyBullets.length > 0 || allActionItems.length > 0 || strategicActions.length > 0)}
          variant="flat"
        >
          <div className="space-y-5">
            <StartupConceptCard
              productIdea={productIdea}
              targetCustomer={targetCustomer}
              monetization={monetization}
              goToMarket={goToMarketSteps}
              fallbackProductIdea={allActionItems[0] ?? opportunities[0] ?? strategyBullets[0]}
              fallbackTargetHint={keyword ? `${keyword} 관련 시장` : null}
              keyword={keyword}
              variant="flat"
            />
            {strategyBullets.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">제품 전략</p>
                <div className="border-l-2 border-primary/35 pl-3">
                  <MarkdownBody className="prose-sm max-w-none text-foreground">
                    {strategyBullets.map((b) => `- ${b}`).join('\n')}
                  </MarkdownBody>
                </div>
              </div>
            )}
            {opportunityReason && (
              <div className="border-l-2 border-muted-foreground/25 pl-3">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">이 기회가 존재하는 이유</p>
                <div className="text-sm text-foreground leading-relaxed">
                  <ExpandableText text={opportunityReason} maxLength={200} expandMode="modal" modalTitle="점수 산출 근거" />
                </div>
              </div>
            )}
            {(strategicActions.length > 0 || allActionItems.length > 0 || mvpIdeas.length > 0) && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">실행 아이디어</p>
                {strategicActions.length > 0 ? (
                  <StrategicActionsSection actions={strategicActions} loading={false} onSaveAction={onSaveToWorkspace} />
                ) : (
                  <ul className="space-y-2 list-none pl-0">
                    {allActionItems.slice(0, 5).map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                        <span className="text-primary shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                    {mvpIdeas.map((m, i) => (
                      <li key={`mvp-${i}`} className="flex gap-2 text-sm">
                        <span className="text-primary shrink-0">•</span>
                        <span>MVP: {m}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {strategyBullets.length === 0 && !opportunityReason && allActionItems.length === 0 && strategicActions.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">전략 제안이 아직 없습니다.</p>
            )}
          </div>
        </ProductStrategySection>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.52, ease: motionConfig.sectionEntrance.ease }}
    >
      {/* Hero: Key Insight + Quick Actions (default layout only) */}
      {!isPmAnalytics && !sectionOnly && (keyInsight || loading) && (
        <div
          className={cn(
            'rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-amber-500/10',
            'dark:from-primary/20 dark:via-primary/10 dark:to-amber-500/5',
            'p-5 sm:p-6 shadow-lg'
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
            <span aria-hidden>🚀</span>
            핵심 인사이트
          </p>
          {loading && !keyInsight ? (
            <div className="h-6 w-4/5 rounded bg-muted/50 animate-pulse" />
          ) : (
            <p className="text-base sm:text-lg font-medium text-foreground leading-snug">
              {keyInsight}
            </p>
          )}
          {(keyInsight || loading) && (
            <QuickActions
              keyInsight={keyInsight}
              getMarkdownContent={getMarkdownContent}
              onSaveToWorkspace={onSaveToWorkspace}
              disabled={loading}
              className="pt-4"
            />
          )}
        </div>
      )}

      {/* 1. 시장 성장 분석 / 시장 기회 */}
      <ProductStrategySection
        id={isPmAnalytics ? 'section-market' : undefined}
        title={isPmAnalytics ? '시장 성장 분석' : '시장 기회'}
        icon={<BarChart3 className="h-5 w-5" />}
        status={isPmAnalytics ? getSectionStatus('trend_analysis', analysisTasks, loading) : undefined}
        loading={isPmAnalytics && loading}
        streamingComplete={isPmAnalytics && !loading && (keyTrends.length > 0 || opportunityScore != null)}
      >
        {(loading && !opportunityScore && keyTrends.length === 0 && Object.keys(breakdown).length === 0) ? (
          <SectionContentSkeleton variant="grid" />
        ) : (
          <div className="space-y-6">
            {/* Visual charts: search trend, market size projection, adoption rate */}
            <MarketGrowthCharts
              opportunityScore={opportunityScore ?? undefined}
              breakdown={breakdown}
              growthSignalsCount={growthSignals.length}
              marketTemperatureScore={typeof trendOutput?.market_temperature_score === 'number' ? trendOutput.market_temperature_score : km.market_temperature_score ?? undefined}
              chartInsights={km.chart_insights}
              opportunityScoreReasoning={opportunityScoreChartDialogText}
              keyword={keyword}
              radarSkeleton={loading && opportunityScore == null && keyTrends.length === 0}
              pmSectionCaption={
                isPmAnalytics
                  ? topInsights[0] ||
                    opportunityScoreSummaryLine ||
                    (opportunityScore != null ? `기회 점수 ${opportunityScore}점은 시장 매력·성장·경쟁 압력을 종합한 결과입니다.` : null)
                  : null
              }
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(opportunityScore != null || loading) && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">시장 규모</p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {loading && opportunityScore == null ? '산출 중...' : opportunityScore != null ? `${opportunityScore}/100` : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">시장 매력도</p>
                </div>
              )}
              {(marketGrowth != null || trendMomentum != null) && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">성장 잠재력</p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {(marketGrowth ?? trendMomentum ?? '—')}/100
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">성장·트렌드 잠재력</p>
                </div>
              )}
            </div>
            <AnalysisCharts
              opportunityScoreBreakdown={Object.keys(breakdown).length > 0 ? breakdown : undefined}
              chartInsights={km.chart_insights}
              className="mb-4"
            />
            {keyTrends.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">핵심 트렌드</p>
                <StreamingBulletList
                  items={keyTrends}
                  streaming={loading}
                  skipAnimation={!loading}
                  revealDelayMs={320}
                />
              </div>
            )}
            {!opportunityScore && keyTrends.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">—</p>
            )}
          </div>
        )}
      </ProductStrategySection>

      {/* 2. Key Insights (default only - pm-analytics has KeyMarketInsightsCard at page level) */}
      {!isPmAnalytics && (
      <ProductStrategySection title="핵심 인사이트" icon={<Lightbulb className="h-5 w-5" />}>
        {loading && topInsights.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : topInsights.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {topInsights.map((insight, i) => (
              <KeyInsightBulletCard
                key={i}
                title={insight}
                index={i + 1}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">핵심 인사이트가 아직 없습니다.</p>
        )}
      </ProductStrategySection>
      )}

      {/* 3. Competitive Landscape / 경쟁 환경 분석 */}
      <ProductStrategySection
        id={isPmAnalytics ? 'section-competition' : undefined}
        title={isPmAnalytics ? '경쟁 환경 분석' : '경쟁 환경'}
        icon={<Users className="h-5 w-5" />}
        status={isPmAnalytics ? getSectionStatus('competition_analysis', analysisTasks, loading) : undefined}
        loading={isPmAnalytics && loading}
        streamingComplete={
          isPmAnalytics &&
          !loading &&
          (competitiveLandscape.length > 0 ||
            competitorTrendsBullets.length > 0 ||
            marketStructureBullets.length > 0 ||
            !!(strategicActionPlan?.roadmap_priorities?.length || strategicActionPlan?.okr_key_results?.length) ||
            !!pmPlanningSummary?.trim() ||
            !!(strategicGaps?.summary?.trim() || strategicGaps?.functional?.length || strategicGaps?.pricing?.length))
        }
      >
        {loading && competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 ? (
          <SectionContentSkeleton variant="mixed" />
        ) : (
          <div className="space-y-4">
            {competitiveLandscape.length > 0 && (
              <>
                {(pmPlanningSummary?.trim() || strategicGaps?.summary?.trim() || (strategicGaps?.functional?.length ?? 0) > 0 || (strategicGaps?.pricing?.length ?? 0) > 0) && (
                  <div className="space-y-3">
                    {pmPlanningSummary?.trim() ? (
                      <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
                        <p className="text-[11px] font-medium text-primary uppercase tracking-wide mb-1">기획 근거 (로드맵·OKR)</p>
                        <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap">{pmPlanningSummary.trim()}</p>
                      </div>
                    ) : null}
                    {(strategicGaps?.summary?.trim() || (strategicGaps?.functional?.length ?? 0) > 0 || (strategicGaps?.pricing?.length ?? 0) > 0) ? (
                      <div className="rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Strategic Gap</p>
                        {strategicGaps?.summary?.trim() ? (
                          <p className="text-sm text-foreground/95 leading-relaxed mb-2">{strategicGaps.summary.trim()}</p>
                        ) : null}
                        {strategicGaps?.functional && strategicGaps.functional.length > 0 ? (
                          <div className="mb-2">
                            <p className="text-[10px] font-semibold text-foreground/80 mb-1">기능 공백</p>
                            <ul className="list-disc list-inside text-xs text-foreground/90 space-y-0.5">
                              {strategicGaps.functional.map((s, i) => (
                                <li key={`f-${i}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        {strategicGaps?.pricing && strategicGaps.pricing.length > 0 ? (
                          <div>
                            <p className="text-[10px] font-semibold text-foreground/80 mb-1">가격·과금 공백</p>
                            <ul className="list-disc list-inside text-xs text-foreground/90 space-y-0.5">
                              {strategicGaps.pricing.map((s, i) => (
                                <li key={`p-${i}`}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                )}
                <CompetitorLandscapeTable
                  competitors={competitiveLandscape}
                  loading={loading}
                />
                <CompetitorBubbleQuadrant
                competitors={competitiveLandscape}
                pmCaption={
                  layout === 'pm-analytics' && competitiveLandscape.length > 0
                    ? `${competitiveLandscape.length}개 주체 기준 상대 점유·성장성을 읽고, 호버로 좌표 근거를 확인하세요.`
                    : null
                }
              />
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">주요 경쟁사</p>
                  <div className="flex flex-wrap gap-2">
                    {competitiveLandscape.slice(0, 8).map((c, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/60 bg-muted/10 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{c.name}</span>
                        {c.positioning && (
                          <span className="text-muted-foreground text-xs ml-1">· {c.positioning}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
            <StrategicActionPlanSection plan={strategicActionPlan} />
            {(competitorTrendsBullets.length > 0 || marketStructureBullets.length > 0) && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">시장 포지셔닝</p>
                <StreamingBulletList
                  items={competitorTrendsBullets.length > 0 ? competitorTrendsBullets : marketStructureBullets}
                  streaming={loading}
                  skipAnimation={!loading}
                  revealDelayMs={280}
                />
              </div>
            )}
            {competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 && marketStructureBullets.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">경쟁 구도 데이터가 없습니다.</p>
            )}
          </div>
        )}
      </ProductStrategySection>

      {/* 3b. Strategy Frameworks: SWOT, JTBD, Porter 5 Forces */}
      {(hasFrameworks || (isPmAnalytics && loading)) && (
      <ProductStrategySection
        id={isPmAnalytics ? 'section-frameworks' : undefined}
        title="제품 전략 프레임워크"
        icon={<LayoutGrid className="h-5 w-5" />}
        status={isPmAnalytics ? getSectionStatus('execution_layer', analysisTasks, loading) : undefined}
        loading={isPmAnalytics && loading}
        streamingComplete={isPmAnalytics && !loading && !!hasFrameworks}
      >
        {loading && !hasFrameworks ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
                <div className="h-4 w-24 rounded bg-muted/50 animate-pulse mb-3" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-3 rounded bg-muted/30 animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StrategyFrameworkPanel
            instanceKey={frameworkPanelKey}
            swot={swot}
            jtbd={jtbd}
            porter={porter5}
            opportunityBreakdown={breakdown}
            strategicDecisionLayer={km.strategic_decision_layer}
            strategyEvaluation={km.strategy_evaluation}
            className="p-4 sm:p-5"
          />
        )}
      </ProductStrategySection>
      )}

      {/* 4. 리스크 평가 (pm-analytics only) */}
      {isPmAnalytics && (
      <ProductStrategySection
        id="section-risks"
        title="리스크 평가"
        icon={<AlertTriangle className="h-5 w-5" />}
        status={getSectionStatus('strategy_generation', analysisTasks, loading)}
        loading={loading}
        streamingComplete={!loading && (risks.length > 0 || riskSignalItems.length > 0)}
      >
        {loading && risks.length === 0 && riskSignalItems.length === 0 ? (
          <SectionContentSkeleton variant="list" />
        ) : riskSignalItems.length > 0 ? (
          <div className="space-y-4">
            <RiskSignalsSeverityList items={riskSignalItems} maxItems={8} />
            {risks.length > 0 ? (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">전략 단계 요약 리스크</p>
                <StreamingRiskList items={risks.slice(0, 5)} streaming={loading} skipAnimation={!loading} revealDelayMs={300} />
              </div>
            ) : null}
          </div>
        ) : risks.length > 0 ? (
          <StreamingRiskList items={risks.slice(0, 5)} streaming={loading} skipAnimation={!loading} revealDelayMs={300} />
        ) : (
          <p className="text-sm text-muted-foreground">리스크 데이터가 없습니다.</p>
        )}
      </ProductStrategySection>
      )}

      {/* 5. Strategy Recommendation / Actionable Startup Concept */}
      <ProductStrategySection
        id={isPmAnalytics ? 'section-strategy' : undefined}
        title={isPmAnalytics ? '제품 전략 제안' : '전략 추천'}
        icon={<Target className="h-5 w-5" />}
        status={isPmAnalytics ? getSectionStatus('execution_layer', analysisTasks, loading) : undefined}
        loading={isPmAnalytics && loading}
        streamingComplete={isPmAnalytics && !loading && (strategyBullets.length > 0 || allActionItems.length > 0 || strategicActions.length > 0)}
        variant={isPmAnalytics ? 'flat' : 'default'}
      >
        {loading && strategyBullets.length === 0 && !opportunityReason && allActionItems.length === 0 ? (
          <SectionContentSkeleton variant="mixed" />
        ) : (
          <div className="space-y-5">
            <StartupConceptCard
              productIdea={productIdea}
              targetCustomer={targetCustomer}
              monetization={monetization}
              goToMarket={goToMarketSteps}
              fallbackProductIdea={allActionItems[0] ?? opportunities[0] ?? strategyBullets[0]}
              fallbackTargetHint={keyword ? `${keyword} 관련 시장` : null}
              keyword={keyword}
              variant={isPmAnalytics ? 'flat' : 'default'}
            />
            {strategyBullets.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">제품 전략</p>
                <div className={cn(isPmAnalytics ? 'border-l-2 border-primary/35 pl-3' : 'rounded-lg border border-border/60 bg-card px-3 py-3 sm:px-4')}>
                  <MarkdownBody className={cn(isPmAnalytics && 'prose-sm max-w-none text-foreground')}>
                    {strategyBullets.map((b) => `- ${b}`).join('\n')}
                  </MarkdownBody>
                </div>
              </div>
            )}
            {opportunityReason && (
              <div
                className={
                  isPmAnalytics
                    ? 'border-l-2 border-muted-foreground/25 pl-3'
                    : 'rounded-lg border border-primary/20 bg-primary/5 p-4'
                }
              >
                <p
                  className={cn(
                    'text-[11px] uppercase tracking-wider mb-1',
                    isPmAnalytics ? 'font-medium text-muted-foreground' : 'font-medium text-primary'
                  )}
                >
                  이 기회가 존재하는 이유
                </p>
                <div className="text-sm text-foreground leading-relaxed">
                  <ExpandableText text={opportunityReason} maxLength={200} expandMode="modal" modalTitle="점수 산출 근거" />
                </div>
              </div>
            )}
            {isPmAnalytics && (strategicActions.length > 0 || allActionItems.length > 0 || mvpIdeas.length > 0) && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">실행 아이디어</p>
                {strategicActions.length > 0 ? (
                  <StrategicActionsSection
                    actions={strategicActions}
                    loading={false}
                    onSaveAction={onSaveToWorkspace}
                  />
                ) : (
                  <ul className="space-y-2 list-none pl-0">
                    {allActionItems.slice(0, 5).map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                        <span className="text-primary shrink-0">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                    {mvpIdeas.map((m, i) => (
                      <li key={`mvp-${i}`} className="flex gap-2 text-sm">
                        <span className="text-primary shrink-0">•</span>
                        <span>MVP: {m}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {strategyBullets.length === 0 && !opportunityReason && (!isPmAnalytics || (allActionItems.length === 0 && strategicActions.length === 0)) && !loading && (
              <p className="text-sm text-muted-foreground">전략 제안이 아직 없습니다.</p>
            )}
          </div>
        )}
      </ProductStrategySection>

      {/* 6. Execution Ideas (default layout only - pm-analytics는 위에서 통합) */}
      {!isPmAnalytics && (
      <ProductStrategySection title="실행 아이디어" icon={<TrendingUp className="h-5 w-5" />}>
        {loading && allActionItems.length === 0 && strategicActions.length === 0 ? (
          <div className="space-y-3">
            <div className="h-24 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-16 rounded-lg bg-muted/30 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-5">
            {strategicActions.length > 0 ? (
              <StrategicActionsSection
                actions={strategicActions}
                loading={false}
                onSaveAction={onSaveToWorkspace}
              />
            ) : (
              <>
                {allActionItems.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">실행 가능한 제품 아이디어</p>
                    <ul className="space-y-2 list-none pl-0">
                      {allActionItems.map((a, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground rounded-lg border border-border/60 bg-muted/10 px-3 py-2">
                          <span className="text-primary shrink-0 mt-0.5">•</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {mvpIdeas.length > 0 && (
                  <div>
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">MVP 제안</p>
                    <ul className="space-y-1.5 list-none pl-0">
                      {mvpIdeas.map((m, i) => (
                        <li key={i} className="flex gap-2 text-sm text-foreground">
                          <span className="text-primary shrink-0">•</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {allActionItems.length === 0 && strategicActions.length === 0 && mvpIdeas.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">실행 아이디어가 아직 없습니다.</p>
            )}
          </div>
        )}
      </ProductStrategySection>
      )}

    </motion.div>
  )
}
