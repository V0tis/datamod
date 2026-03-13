'use client'

import { useState, memo } from 'react'
import { TrendingUp, Shield, Target, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'

function scoreToLabel(score: number): string {
  if (score >= 70) return '높음'
  if (score >= 40) return '중간'
  return '낮음'
}

export interface ResultSummaryCardsProps {
  result: ResearchResponse | null
  consensusData?: { strategicSummary?: { summary?: string; opportunity?: string } } | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{
    step_name: string
    status: string
    output_data: unknown
  }> | null
  loading?: boolean
  className?: string
}

function SummaryCard({ card }: { card: { id: string; label: string; value: string | null; icon: typeof TrendingUp; showCalculating?: boolean } }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = card.icon
  const displayValue = card.id === 'opportunity' && card.showCalculating && !card.value
    ? '산출 중...'
    : (card.value || '—')
  const isLong = typeof displayValue === 'string' && displayValue.length > 60

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/8 to-transparent p-5 shadow-sm',
        'transition-colors hover:border-primary/40 hover:from-primary/12'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {card.label}
        </span>
      </div>
      <p className={cn('text-base font-bold text-foreground leading-snug', isLong && !expanded && 'line-clamp-2')}>
        {displayValue}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs text-primary hover:text-primary/80 font-medium"
        >
          {expanded ? '접기' : '더보기'}
        </button>
      )}
    </div>
  )
}

export const ResultSummaryCards = memo(function ResultSummaryCards({
  result,
  consensusData,
  taskData = {},
  analysisTasks,
  loading = false,
  className,
}: ResultSummaryCardsProps) {
  const km = result?.key_metrics ?? {}
  const breakdown = km.opportunity_score_breakdown ?? {}
  const opportunityScore = typeof km.opportunity_score === 'number' ? km.opportunity_score : null
  const marketGrowth = typeof breakdown.market_growth === 'number' ? breakdown.market_growth : null
  const trendMomentum = typeof breakdown.trend_momentum === 'number' ? breakdown.trend_momentum : null
  const competitionDensity = typeof breakdown.competition_density === 'number' ? breakdown.competition_density : null
  const competitionPressure = typeof breakdown.competition_pressure === 'number' ? breakdown.competition_pressure : null

  const strategyTask = analysisTasks?.find((t) => t.step_name === 'strategy_generation')
  const strategyOutput = (strategyTask?.output_data && typeof strategyTask.output_data === 'object'
    ? strategyTask.output_data
    : taskData?.strategy_generation) as { strategy_summary?: string } | undefined
  const strategySummary = typeof strategyOutput?.strategy_summary === 'string' ? strategyOutput.strategy_summary : ''
  const pmActions = km.pm_actions?.recommended_actions ?? []
  const topAction = pmActions[0]?.title ?? ''
  const summaryInsights = (km.summary_insights ?? '').trim()
  const consensusSummary = consensusData?.strategicSummary?.summary ?? ''
  const strategyText = strategySummary?.trim()
  const recommendedStrategy =
    topAction || strategyText || summaryInsights || consensusSummary || '—'

  const marketGrowthScore = marketGrowth ?? trendMomentum ?? opportunityScore ?? null
  const competitionScore = competitionDensity ?? competitionPressure ?? null

  const cards = [
    {
      id: 'market-growth',
      label: '시장 성장성',
      value: marketGrowthScore != null ? scoreToLabel(marketGrowthScore) : null,
      icon: TrendingUp,
    },
    {
      id: 'competition',
      label: '경쟁 강도',
      value: competitionScore != null ? scoreToLabel(competitionScore) : null,
      icon: Shield,
    },
    {
      id: 'strategy',
      label: '추천 전략',
      value: recommendedStrategy,
      icon: Target,
    },
    {
      id: 'opportunity',
      label: '시장 기회',
      value: opportunityScore != null ? scoreToLabel(opportunityScore) : null,
      icon: Sparkles,
      showCalculating: loading,
    },
  ]

  if (loading && !result) {
    return (
      <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-3', className)}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-muted/10 p-4 animate-pulse">
            <div className="h-4 w-20 bg-muted/50 rounded mb-3" />
            <div className="h-6 w-16 bg-muted/40 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', className)}>
      {cards.map((card) => (
        <SummaryCard key={card.id} card={card} />
      ))}
    </div>
  )
})
