'use client'

import {
  BarChart3,
  Users,
  Lightbulb,
  Target,
  TrendingUp,
} from 'lucide-react'
import { ProductStrategySection } from '@/components/research/ProductStrategySection'
import { KeyInsightBulletCard } from '@/components/research/KeyInsightBulletCard'
import { QuickActions } from '@/components/research/QuickActions'
import { StrategicActionsSection, type StrategicActionItem } from '@/components/research/StrategicActionsSection'
import { textToBullets } from '@/lib/text-to-bullets'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'

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
}

export function AnalysisResultSections({
  result,
  taskData = {},
  analysisTasks = null,
  consensusData,
  loading = false,
  keyword = '',
  onSaveToWorkspace,
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
  const strategicActions: StrategicActionItem[] = pmActions
    .map((a, i) => {
      const title = a?.title ?? (a as { action?: string })?.action ?? ''
      const reasoning = typeof (a as { reasoning?: string })?.reasoning === 'string'
        ? (a as { reasoning: string }).reasoning.trim()
        : ''
      const relatedRisk = typeof (a as { related_risk?: string })?.related_risk === 'string'
        ? (a as { related_risk: string }).related_risk.trim()
        : ''
      const desc = relatedRisk ? `Addresses: ${relatedRisk}. ${reasoning}`.trim() : reasoning || 'Market analysis supports this direction.'
      const opp = opportunities[i] || reasoning || `Focus on ${title || 'this area'} as a product initiative.`
      return {
        id: `action-${i}-${(title || '').slice(0, 30).replace(/\s+/g, '-')}`,
        title: title || `Action ${i + 1}`,
        description: desc,
        opportunity: opp !== desc ? opp : `Build products that address: ${title || 'this opportunity'}.`,
      }
    })
    .filter((a) => a.title && (a.description || a.opportunity))

  const keyInsightRaw = topInsights[0] || ''
  const keyInsight = keyInsightRaw.length > 120 ? keyInsightRaw.slice(0, 117).trim() + '...' : keyInsightRaw

  const getMarkdownContent = () => {
    const lines: string[] = []
    lines.push(`# Market Analysis: ${keyword || 'Insight'}`)
    lines.push('')
    if (keyInsightRaw) {
      lines.push('## Key Insight')
      lines.push('')
      lines.push(keyInsightRaw)
      lines.push('')
    }
    lines.push('## Market Opportunity')
    if (opportunityScore != null) lines.push(`- Market size / opportunity: ${opportunityScore}/100`)
    if (marketGrowth != null) lines.push(`- Growth: ${marketGrowth}/100`)
    keyTrends.forEach((t) => lines.push(`- ${t}`))
    lines.push('')
    lines.push('## Key Insights')
    topInsights.forEach((i) => lines.push(`- ${i}`))
    lines.push('')
    lines.push('## Competitive Landscape')
    competitiveLandscape.forEach((c) => lines.push(`- **${c.name}**${c.positioning ? ` · ${c.positioning}` : ''}`))
    if (competitorTrendsBullets.length > 0) competitorTrendsBullets.forEach((b) => lines.push(`- ${b}`))
    lines.push('')
    lines.push('## Strategy Recommendation')
    strategyBullets.forEach((b) => lines.push(`- ${b}`))
    if (opportunityReason) lines.push('', `**Why this opportunity:** ${opportunityReason}`)
    lines.push('')
    lines.push('## Execution Ideas')
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

  if (!hasAnyContent && !loading) return null

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero: Key Insight + Quick Actions */}
      {(keyInsight || loading) && (
        <div
          className={cn(
            'rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-primary/8 to-amber-500/10',
            'dark:from-primary/20 dark:via-primary/10 dark:to-amber-500/5',
            'p-5 sm:p-6 shadow-lg'
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-2 flex items-center gap-2">
            <span aria-hidden>🚀</span>
            Key Insight
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

      {/* 1. Market Opportunity */}
      <ProductStrategySection title="Market Opportunity" icon={<BarChart3 className="h-5 w-5" />}>
        {loading && !opportunityScore && keyTrends.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {opportunityScore != null && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Market Size</p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">{opportunityScore}/100</p>
                  <p className="text-xs text-muted-foreground mt-0.5">시장 매력도</p>
                </div>
              )}
              {(marketGrowth != null || trendMomentum != null) && (
                <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Growth Potential</p>
                  <p className="text-xl font-semibold text-foreground tabular-nums">
                    {(marketGrowth ?? trendMomentum ?? '—')}/100
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">성장·트렌드 잠재력</p>
                </div>
              )}
            </div>
            {keyTrends.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Key Trends</p>
                <ul className="space-y-1.5 list-none pl-0">
                  {keyTrends.map((t, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="text-primary shrink-0">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!opportunityScore && keyTrends.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">시장 기회 데이터를 분석 중입니다.</p>
            )}
          </div>
        )}
      </ProductStrategySection>

      {/* 2. Key Insights */}
      <ProductStrategySection title="Key Insights" icon={<Lightbulb className="h-5 w-5" />}>
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

      {/* 3. Competitive Landscape */}
      <ProductStrategySection title="Competitive Landscape" icon={<Users className="h-5 w-5" />}>
        {loading && competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 ? (
          <div className="space-y-3">
            <div className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-12 rounded-lg bg-muted/30 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {competitiveLandscape.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Major Competitors</p>
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
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Market Positioning</p>
                <ul className="space-y-1.5 list-none pl-0">
                  {(competitorTrendsBullets.length > 0 ? competitorTrendsBullets : marketStructureBullets).map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="text-muted-foreground shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {competitiveLandscape.length === 0 && competitorTrendsBullets.length === 0 && marketStructureBullets.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">경쟁 구도 데이터가 없습니다.</p>
            )}
          </div>
        )}
      </ProductStrategySection>

      {/* 4. Strategy Recommendation */}
      <ProductStrategySection title="Strategy Recommendation" icon={<Target className="h-5 w-5" />}>
        {loading && strategyBullets.length === 0 && !opportunityReason ? (
          <div className="space-y-3">
            <div className="h-12 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-8 rounded-lg bg-muted/30 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {strategyBullets.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Product Strategy</p>
                <ul className="space-y-1.5 list-none pl-0">
                  {strategyBullets.map((b, i) => (
                    <li key={i} className="flex gap-2 text-sm text-foreground">
                      <span className="text-primary shrink-0">•</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {opportunityReason && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-1">Why This Opportunity Exists</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {opportunityReason.length > 200 ? opportunityReason.slice(0, 197).trim() + '...' : opportunityReason}
                </p>
              </div>
            )}
            {strategyBullets.length === 0 && !opportunityReason && !loading && (
              <p className="text-sm text-muted-foreground">전략 제안이 아직 없습니다.</p>
            )}
          </div>
        )}
      </ProductStrategySection>

      {/* 5. Execution Ideas */}
      <ProductStrategySection title="Execution Ideas" icon={<TrendingUp className="h-5 w-5" />}>
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
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Actionable Product Ideas</p>
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
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">MVP Suggestions</p>
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

    </div>
  )
}
