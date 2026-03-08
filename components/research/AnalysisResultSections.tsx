'use client'

import {
  BarChart3,
  Users,
  Lightbulb,
  Target,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react'
import { ProductStrategySection } from '@/components/research/ProductStrategySection'
import { KeyInsightBulletCard } from '@/components/research/KeyInsightBulletCard'
import { QuickActions } from '@/components/research/QuickActions'
import { StrategicActionsSection, type StrategicActionItem } from '@/components/research/StrategicActionsSection'
import { textToBullets } from '@/lib/text-to-bullets'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { StreamingBulletList } from '@/components/research/StreamingInsightText'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
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
  const order = ['signal_layer', 'trend_analysis', 'competition_analysis', 'strategy_generation', 'execution_layer']
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
}: AnalysisResultSectionsProps) {
  const km = result?.key_metrics ?? {}
  const trendOutput = getTaskOutput('trend_analysis', taskData, analysisTasks)
  const competitionOutput = getTaskOutput('competition_analysis', taskData, analysisTasks)
  const strategyOutput = getTaskOutput('strategy_generation', taskData, analysisTasks)

  // Market Opportunity
  const opportunityScore = typeof km.opportunity_score === 'number' ? km.opportunity_score : null
  const breakdown = km.opportunity_score_breakdown ?? {}
  const marketGrowth = typeof breakdown.market_growth === 'number' ? breakdown.market_growth : null
  const trendMomentum = typeof breakdown.trend_momentum === 'number' ? breakdown.trend_momentum : null
  const growthSignals = Array.isArray(trendOutput?.growth_signals)
    ? (trendOutput.growth_signals as string[]).filter((s) => typeof s === 'string').slice(0, 5)
    : []
  const keyTrends = [
    ...growthSignals,
    ...(km.positive_signals ?? []).slice(0, 3),
  ].filter(Boolean).slice(0, 5)

  // Key Insights (Top 3)
  const valueProposition = (consensusData?.strategicSummary?.opportunity ?? '').trim()
  const opportunities = Array.isArray(strategyOutput?.opportunities)
    ? (strategyOutput.opportunities as string[]).filter((s) => typeof s === 'string')
    : km.positive_signals ?? result?.marketNews ?? []
  const keyConclusions = result?.keyConclusions ?? (km.keyConclusions as string[] | undefined) ?? []
  const summaryInsights = (km.summary_insights ?? '').trim()
  const strategySummary = typeof strategyOutput?.strategy_summary === 'string'
    ? strategyOutput.strategy_summary
    : ''

  const topInsights = [
    valueProposition,
    opportunities[0],
    keyConclusions[0],
    summaryInsights,
    strategySummary,
  ].filter((s) => s && s.length > 0).slice(0, 3)

  // Competitive Landscape
  const competitiveLandscape = Array.isArray(competitionOutput?.competitive_landscape)
    ? (competitionOutput.competitive_landscape as Array<{ name?: string; positioning?: string }>)
    : []
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

  // Strategic Actions for existing component
  const risks = Array.isArray(strategyOutput?.risks)
    ? (strategyOutput.risks as string[]).filter((s): s is string => typeof s === 'string')
    : (km.negative_risks ?? result?.painPoints ?? [])

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
  const keyInsight = keyInsightRaw.length > 120 ? keyInsightRaw.slice(0, 117).trim() + '...' : keyInsightRaw

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
    if (opportunityScore != null) lines.push(`- Market size / opportunity: ${opportunityScore}/100`)
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
    strategicActions.length > 0

  const isPmAnalytics = layout === 'pm-analytics'
  const showProgressiveSections = isPmAnalytics && (loading || (analysisTasks?.length ?? 0) > 0 || result != null)
  if (!hasAnyContent && !loading && !showProgressiveSections) return null

  return (
    <div className="space-y-12 animate-in fade-in duration-300">
      {/* Hero: Key Insight + Quick Actions (default layout only) */}
      {!isPmAnalytics && (keyInsight || loading) && (
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
        {loading && !opportunityScore && keyTrends.length === 0 ? (
          <SectionContentSkeleton variant="grid" />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {opportunityScore != null && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">시장 규모</p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">{opportunityScore}/100</p>
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
              <p className="text-sm text-muted-foreground">시장 기회 데이터를 분석 중입니다.</p>
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
                title={insight.length > 140 ? insight.slice(0, 137).trim() + '...' : insight}
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
        streamingComplete={isPmAnalytics && !loading && (competitiveLandscape.length > 0 || competitorTrendsBullets.length > 0 || marketStructureBullets.length > 0)}
      >
        {loading && competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 ? (
          <SectionContentSkeleton variant="mixed" />
        ) : (
          <div className="space-y-4">
            {competitiveLandscape.length > 0 && (
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
            )}
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

      {/* 4. 리스크 평가 (pm-analytics only) */}
      {isPmAnalytics && (
      <ProductStrategySection
        id="section-risks"
        title="리스크 평가"
        icon={<AlertTriangle className="h-5 w-5" />}
        status={getSectionStatus('strategy_generation', analysisTasks, loading)}
        loading={loading}
        streamingComplete={!loading && risks.length > 0}
      >
        {loading && risks.length === 0 ? (
          <SectionContentSkeleton variant="list" />
        ) : risks.length > 0 ? (
          <StreamingBulletList
            items={risks.slice(0, 5)}
            streaming={loading}
            skipAnimation={!loading}
            revealDelayMs={300}
            variant="risk"
          />
        ) : (
          <p className="text-sm text-muted-foreground">리스크 데이터가 없습니다.</p>
        )}
      </ProductStrategySection>
      )}

      {/* 5. Strategy Recommendation / 제품 전략 제안 (pm-analytics: 전략+실행 통합) */}
      <ProductStrategySection
        id={isPmAnalytics ? 'section-strategy' : undefined}
        title={isPmAnalytics ? '제품 전략 제안' : '전략 추천'}
        icon={<Target className="h-5 w-5" />}
        status={isPmAnalytics ? getSectionStatus('execution_layer', analysisTasks, loading) : undefined}
        loading={isPmAnalytics && loading}
        streamingComplete={isPmAnalytics && !loading && (strategyBullets.length > 0 || allActionItems.length > 0 || strategicActions.length > 0)}
      >
        {loading && strategyBullets.length === 0 && !opportunityReason && allActionItems.length === 0 ? (
          <SectionContentSkeleton variant="mixed" />
        ) : (
          <div className="space-y-4">
            {strategyBullets.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">제품 전략</p>
                <StreamingBulletList
                  items={strategyBullets}
                  streaming={loading}
                  skipAnimation={!loading}
                  revealDelayMs={320}
                />
              </div>
            )}
            {opportunityReason && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">이 기회가 존재하는 이유</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {opportunityReason.length > 200 ? opportunityReason.slice(0, 197).trim() + '...' : opportunityReason}
                </p>
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

    </div>
  )
}
