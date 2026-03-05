'use client'

import {
  BarChart3,
  Radio,
  Hash,
  Users,
  Lightbulb,
} from 'lucide-react'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { MarketTemperature } from '@/components/research/market-temperature'
import { QuickActions } from '@/components/research/QuickActions'
import { StrategicActionsSection, type StrategicActionItem } from '@/components/research/StrategicActionsSection'
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
    strategicSummary?: { summary?: string; opportunity?: string }
  } | null
  loading?: boolean
  /** Keyword for markdown export title */
  keyword?: string
  /** Save to workspace (same as Save insight) */
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
  const signalOutput = getTaskOutput('signal_layer', taskData, analysisTasks)
  const trendOutput = getTaskOutput('trend_analysis', taskData, analysisTasks)
  const competitionOutput = getTaskOutput('competition_analysis', taskData, analysisTasks)
  const strategyOutput = getTaskOutput('strategy_generation', taskData, analysisTasks)

  // Market Overview
  const summaryInsights = km.summary_insights ?? result?.keyConclusions?.[0] ?? ''
  const trendSummary = (typeof trendOutput?.trend_summary === 'string'
    ? trendOutput.trend_summary
    : typeof trendOutput?.summary === 'string'
      ? trendOutput.summary
      : '') as string
  const marketTempScoreNorm =
    typeof consensusData?.sentiment?.score === 'number'
      ? consensusData.sentiment.score
      : typeof km.market_temperature_score === 'number'
        ? (km.market_temperature_score - 50) * 2
        : typeof trendOutput?.market_temperature_score === 'number'
          ? (Number(trendOutput.market_temperature_score) - 50) * 2
          : null
  const competitorTrends = result?.competitorTrends ?? ''

  // Key Signals
  const positiveSignals = km.positive_signals ?? []
  const neutralSignals = km.neutral_signals ?? []
  const negativeRisks = km.negative_risks ?? result?.painPoints ?? []
  const growthSignals = Array.isArray(trendOutput?.growth_signals)
    ? (trendOutput.growth_signals as string[]).filter((s) => typeof s === 'string')
    : []
  const signalLayerSignals = Array.isArray(signalOutput?.signals)
    ? (signalOutput.signals as string[]).filter((s) => typeof s === 'string')
    : []
  const allSignals = [
    ...positiveSignals,
    ...neutralSignals,
    ...negativeRisks,
    ...growthSignals,
    ...signalLayerSignals,
  ].filter(Boolean)

  // Emerging Keywords (from signals, growth_signals, news headlines)
  const newsActivity = Array.isArray(signalOutput?.news_activity)
    ? (signalOutput.news_activity as Array<{ title?: string }>)
    : []
  const headlines = newsActivity
    .map((n) => (n.title ?? '').trim().slice(0, 80))
    .filter(Boolean)
  const emergingKeywords = [
    ...new Set([
      ...(Array.isArray(signalLayerSignals) ? signalLayerSignals : []),
      ...growthSignals,
      ...headlines.slice(0, 3).flatMap((h) => h.split(/\s+/).slice(0, 3)),
    ]),
  ]
    .filter((s) => typeof s === 'string' && s.length > 2)
    .slice(0, 12)

  // Competitive Landscape
  const competitiveLandscape = Array.isArray(competitionOutput?.competitive_landscape)
    ? (competitionOutput.competitive_landscape as Array<{ name?: string; positioning?: string }>)
    : []
  const marketStructure =
    typeof competitionOutput?.market_structure === 'string'
      ? competitionOutput.market_structure
      : ''

  // Strategic Insight
  const opportunities = Array.isArray(strategyOutput?.opportunities)
    ? (strategyOutput.opportunities as string[]).filter((s) => typeof s === 'string')
    : km.positive_signals ?? result?.marketNews ?? []
  const risks = Array.isArray(strategyOutput?.risks)
    ? (strategyOutput.risks as string[]).filter((s) => typeof s === 'string')
    : []
  const strategySummary =
    typeof strategyOutput?.strategy_summary === 'string'
      ? strategyOutput.strategy_summary
      : summaryInsights
  const keyConclusions = result?.keyConclusions ?? (km.keyConclusions as string[] | undefined) ?? []
  const pmActions = km.pm_actions?.recommended_actions ?? []
  const actionItems = pmActions.map((a) => a?.title ?? (a as { action?: string })?.action ?? '').filter(Boolean)
  const valueProposition = consensusData?.strategicSummary?.opportunity ?? undefined

  // Build Strategic Actions: title (action), description (context), opportunity (product direction)
  const strategicActions: StrategicActionItem[] = pmActions
    .map((a, i) => {
      const title = a?.title ?? (a as { action?: string })?.action ?? ''
      const reasoning = typeof (a as { reasoning?: string })?.reasoning === 'string'
        ? (a as { reasoning: string }).reasoning.trim()
        : ''
      const relatedRisk = typeof (a as { related_risk?: string })?.related_risk === 'string'
        ? (a as { related_risk: string }).related_risk.trim()
        : ''
      const desc = relatedRisk
        ? `Addresses: ${relatedRisk}. ${reasoning}`.trim()
        : reasoning || summaryInsights?.slice(0, 200) || trendSummary?.slice(0, 200) || 'Market analysis supports this direction.'
      const opp = opportunities[i] || reasoning || `Focus on ${title || 'this area'} as a product initiative.`
      return {
        id: `action-${i}-${(title || '').slice(0, 30).replace(/\s+/g, '-')}`,
        title: title || `Action ${i + 1}`,
        description: desc,
        opportunity: opp !== desc ? opp : `Build products that address: ${title || 'this opportunity'}.`,
      }
    })
    .filter((a) => a.title && (a.description || a.opportunity))

  const hasMarketOverview =
    Boolean(summaryInsights?.trim()) ||
    Boolean(trendSummary?.trim()) ||
    Boolean(competitorTrends?.trim()) ||
    marketTempScoreNorm != null
  const hasKeySignals = allSignals.length > 0
  const hasEmergingKeywords = emergingKeywords.length > 0
  const hasCompetitive =
    competitiveLandscape.length > 0 ||
    Boolean(marketStructure?.trim()) ||
    Boolean(competitorTrends?.trim())
  const hasStrategic =
    Boolean(strategySummary?.trim()) ||
    opportunities.length > 0 ||
    keyConclusions.length > 0 ||
    actionItems.length > 0 ||
    Boolean(valueProposition?.trim())

  // Key Insight: most impactful one-liner for the card
  const keyInsightRaw =
    (valueProposition?.trim()) ||
    (opportunities[0]?.trim()) ||
    (keyConclusions[0]?.trim()) ||
    (strategySummary?.trim()) ||
    (summaryInsights?.trim()) ||
    (growthSignals[0]?.trim()) ||
    ''
  const keyInsight = keyInsightRaw.length > 120
    ? keyInsightRaw.slice(0, 117).trim() + '...'
    : keyInsightRaw

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
    if (summaryInsights || trendSummary || competitorTrends) {
      lines.push('## Market Overview')
      lines.push('')
      if (summaryInsights) lines.push(summaryInsights)
      if (trendSummary && trendSummary !== summaryInsights) lines.push(trendSummary)
      if (competitorTrends) lines.push('', '### 경쟁사 동향', '', competitorTrends)
      lines.push('')
    }
    if (allSignals.length > 0) {
      lines.push('## Key Signals')
      lines.push('')
      if (positiveSignals.length > 0) {
        lines.push('### 긍정 신호')
        positiveSignals.forEach((s) => lines.push(`- ${s}`))
        lines.push('')
      }
      if (neutralSignals.length > 0) {
        lines.push('### 중립')
        neutralSignals.forEach((s) => lines.push(`- ${s}`))
        lines.push('')
      }
      if (negativeRisks.length > 0) {
        lines.push('### 부정 · 리스크')
        negativeRisks.forEach((s) => lines.push(`- ${s}`))
        lines.push('')
      }
    }
    if (emergingKeywords.length > 0) {
      lines.push('## Emerging Keywords')
      lines.push('')
      lines.push(emergingKeywords.join(' · '))
      lines.push('')
    }
    if (marketStructure || competitiveLandscape.length > 0 || competitorTrends) {
      lines.push('## Competitive Landscape')
      lines.push('')
      if (marketStructure) lines.push(marketStructure)
      if (competitiveLandscape.length > 0) {
        lines.push('', '### 경쟁사')
        competitiveLandscape.forEach((c) =>
          lines.push(`- **${c.name}**${c.positioning ? ` · ${c.positioning}` : ''}`)
        )
      }
      lines.push('')
    }
    if (strategicActions.length > 0) {
      lines.push('## Strategic Actions')
      lines.push('')
      strategicActions.forEach((a, i) => {
        lines.push(`### ${i + 1}. ${a.title}`)
        lines.push('')
        lines.push('**Description:**', a.description, '')
        lines.push('**Opportunity:**', a.opportunity, '')
      })
      lines.push('')
    }
    if (strategySummary || opportunities.length > 0 || keyConclusions.length > 0 || actionItems.length > 0) {
      lines.push('## Strategic Insight')
      lines.push('')
      if (valueProposition) lines.push(`**Core value proposition:** ${valueProposition}`, '')
      if (strategySummary) lines.push(strategySummary, '')
      if (opportunities.length > 0) {
        lines.push('### Market opportunities')
        opportunities.forEach((o) => lines.push(`- ${o}`))
        lines.push('')
      }
      if (keyConclusions.length > 0) {
        lines.push('### Key product direction')
        keyConclusions.forEach((k) => lines.push(`- ${k}`))
        lines.push('')
      }
      if (risks.length > 0) {
        lines.push('### 리스크')
        risks.forEach((r) => lines.push(`- ${r}`))
        lines.push('')
      }
      if (actionItems.length > 0) {
        lines.push('### Action Plan')
        actionItems.forEach((a) => lines.push(`- ${a}`))
      }
    }
    return lines.join('\n')
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Key Insight card - top highlight */}
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
        </div>
      )}

      {/* Quick actions */}
      {(keyInsight || loading) && (
        <QuickActions
          keyInsight={keyInsight}
          getMarkdownContent={getMarkdownContent}
          onSaveToWorkspace={onSaveToWorkspace}
          disabled={loading}
          className="pt-1"
        />
      )}

      {/* Strategic Actions - actionable product strategy from AI insights */}
      <StrategicActionsSection
        actions={strategicActions}
        loading={loading && strategicActions.length === 0}
        onSaveAction={onSaveToWorkspace}
      />

      {/* 1. Market Overview */}
      <CollapsibleSection
        title="Market Overview"
        icon={<BarChart3 className="h-5 w-5" />}
        defaultExpanded={true}
        hasContent={hasMarketOverview || loading}
      >
        {loading && !hasMarketOverview ? (
          <div className="space-y-3">
            <div className="h-4 w-3/4 rounded bg-muted/60 animate-pulse" />
            <div className="h-20 rounded-lg bg-muted/40 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {marketTempScoreNorm != null && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  시장 온도
                </p>
                <MarketTemperature
                  score={marketTempScoreNorm}
                  trend={consensusData?.sentiment?.trend ?? 'stable'}
                  factors={km.chartData?.sentiment}
                  positiveSignals={positiveSignals.slice(0, 3)}
                  neutralSignals={neutralSignals.slice(0, 2)}
                  negativeRisks={negativeRisks.slice(0, 3)}
                />
              </div>
            )}
            {(summaryInsights || trendSummary) && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  시장 요약
                </p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {summaryInsights || trendSummary}
                </p>
              </div>
            )}
            {competitorTrends && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  경쟁사 동향
                </p>
                <p className="text-sm text-foreground leading-relaxed">{competitorTrends}</p>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* 2. Key Signals */}
      <CollapsibleSection
        title="Key Signals"
        icon={<Radio className="h-5 w-5" />}
        defaultExpanded={true}
        hasContent={hasKeySignals || loading}
      >
        {loading && !hasKeySignals ? (
          <ul className="space-y-2 pl-4">
            {[1, 2, 3, 4].map((i) => (
              <li key={i} className="h-4 rounded bg-muted/40 animate-pulse" />
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            {positiveSignals.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                  긍정 신호
                </p>
                <ul className="space-y-1 list-none pl-0">
                  {positiveSignals.slice(0, 5).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-1">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {neutralSignals.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  중립
                </p>
                <ul className="space-y-1 list-none pl-0">
                  {neutralSignals.slice(0, 3).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-muted-foreground mt-1">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {negativeRisks.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-destructive/80 uppercase tracking-wider mb-2">
                  부정 · 리스크
                </p>
                <ul className="space-y-1 list-none pl-0">
                  {negativeRisks.slice(0, 5).map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-destructive mt-1">•</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {growthSignals.length > 0 && positiveSignals.length === 0 && neutralSignals.length === 0 && negativeRisks.length === 0 && (
              <ul className="space-y-1 list-none pl-0">
                {growthSignals.slice(0, 6).map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="text-primary mt-1">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* 3. Emerging Keywords */}
      <CollapsibleSection
        title="Emerging Keywords"
        icon={<Hash className="h-5 w-5" />}
        defaultExpanded={false}
        hasContent={hasEmergingKeywords || loading}
      >
        {loading && !hasEmergingKeywords ? (
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className="h-7 w-20 rounded-full bg-muted/60 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {emergingKeywords.map((kw, i) => (
              <span
                key={i}
                className="rounded-full border border-border bg-muted/30 px-3 py-1 text-xs font-medium text-foreground"
              >
                {kw}
              </span>
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* 4. Competitive Landscape */}
      <CollapsibleSection
        title="Competitive Landscape"
        icon={<Users className="h-5 w-5" />}
        defaultExpanded={false}
        hasContent={hasCompetitive || loading}
      >
        {loading && !hasCompetitive ? (
          <div className="space-y-3">
            <div className="h-4 w-full rounded bg-muted/60 animate-pulse" />
            <div className="h-16 rounded bg-muted/40 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {marketStructure && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  시장 구조
                </p>
                <p className="text-sm text-foreground leading-relaxed">{marketStructure}</p>
              </div>
            )}
            {competitiveLandscape.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  경쟁사
                </p>
                <div className="flex flex-wrap gap-2">
                  {competitiveLandscape.slice(0, 10).map((c, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.positioning && (
                        <span className="text-muted-foreground ml-1">· {c.positioning}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {competitorTrends && !marketStructure && competitiveLandscape.length === 0 && (
              <p className="text-sm text-foreground leading-relaxed">{competitorTrends}</p>
            )}
          </div>
        )}
      </CollapsibleSection>

      {/* 5. Strategic Insight */}
      <CollapsibleSection
        title="Strategic Insight"
        icon={<Lightbulb className="h-5 w-5" />}
        defaultExpanded={true}
        hasContent={hasStrategic || loading}
      >
        {loading && !hasStrategic ? (
          <div className="space-y-3">
            <div className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            <div className="h-4 w-full rounded bg-muted/30 animate-pulse" />
          </div>
        ) : (
          <div className="space-y-4">
            {valueProposition && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Core value proposition
                </p>
                <p className="text-sm text-foreground">{valueProposition}</p>
              </div>
            )}
            {strategySummary && (
              <div className="rounded-lg border border-border/60 bg-muted/10 p-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {strategySummary}
                </p>
              </div>
            )}
            {opportunities.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Market opportunities
                </p>
                <ul className="space-y-2">
                  {opportunities.slice(0, 5).map((opp, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{opp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {keyConclusions.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Key product direction
                </p>
                <ul className="space-y-2">
                  {keyConclusions.slice(0, 5).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {risks.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-destructive/80 uppercase tracking-wider mb-2">
                  리스크
                </p>
                <ul className="space-y-1">
                  {risks.slice(0, 4).map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <span className="text-destructive mt-0.5">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {actionItems.length > 0 && (
              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Action Plan
                </p>
                <ul className="space-y-2">
                  {actionItems.slice(0, 8).map((action, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-foreground">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        aria-hidden
                      />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}
