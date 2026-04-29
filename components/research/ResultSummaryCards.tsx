'use client'

import { useState, memo } from 'react'
import { TrendingUp, Shield, Target, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { CompactMarkdown } from '@/components/ui/compact-markdown'

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
  /** saas: 흰 카드·그레이 보더 (분석 L-대시보드 등) */
  variant?: 'default' | 'saas'
}

function looksLikeMarkdown(s: string): boolean {
  return /(^|\n)#{1,6}\s|(\*\*|__|\*|_[^_\s]|\n[-*]\s|`)/.test(s)
}

function SummaryCard({
  card,
  variant,
}: {
  card: { id: string; label: string; value: string | null; icon: typeof TrendingUp; showCalculating?: boolean; explanation?: string | null }
  variant: 'default' | 'saas'
}) {
  const [expanded, setExpanded] = useState(false)
  const Icon = card.icon
  const displayValue = card.id === 'opportunity' && card.showCalculating && !card.value
    ? '산출 중...'
    : (card.value || '—')
  const isLong = typeof displayValue === 'string' && displayValue.length > 60
  const showReason = !!card.explanation
  const valueMarkdown =
    card.id === 'strategy' ||
    (typeof displayValue === 'string' && displayValue !== '—' && displayValue !== '산출 중...' && looksLikeMarkdown(displayValue))
  const explanationMarkdown = !!card.explanation && looksLikeMarkdown(card.explanation)

  return (
    <div
      className={cn(
        'rounded-xl p-5 shadow-sm transition-colors',
        variant === 'saas'
          ? 'border border-slate-100 bg-white shadow-sm hover:border-slate-200   '
          : 'border-2 border-primary/20 bg-gradient-to-br from-primary/8 to-transparent hover:border-primary/40 hover:from-primary/12'
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-5 w-5 shrink-0 text-slate-500 " aria-hidden />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {card.label}
        </span>
      </div>
      {valueMarkdown && typeof displayValue === 'string' && displayValue !== '—' && displayValue !== '산출 중...' ? (
        <div className={cn('text-foreground leading-snug', isLong && !expanded && 'line-clamp-2')}>
          <CompactMarkdown
            source={displayValue}
            className="!text-base !font-bold [&_ul]:!font-medium [&_ol]:!font-medium [&_li]:!text-sm [&_li]:!font-medium"
          />
        </div>
      ) : (
        <div className={cn('text-base font-bold text-foreground leading-snug', isLong && !expanded && 'line-clamp-2')}>
          {displayValue}
        </div>
      )}
      {showReason &&
        (explanationMarkdown ? (
          <div className="mt-1.5 text-[11px] text-muted-foreground leading-snug [&_p]:text-[11px] [&_li]:text-[11px]">
            <CompactMarkdown source={card.explanation!} />
          </div>
        ) : (
          <div className="mt-1.5 text-[11px] text-muted-foreground leading-snug">{card.explanation}</div>
        ))}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-xs font-medium text-emerald-800 hover:text-emerald-900 "
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
  variant = 'default',
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

  const marketGrowthLabel = marketGrowthScore != null ? scoreToLabel(marketGrowthScore) : null
  const competitionLabel = competitionScore != null ? scoreToLabel(competitionScore) : null
  const opportunityLabel = opportunityScore != null ? scoreToLabel(opportunityScore) : null

  const sdl = km.strategic_decision_layer
  const marketGrowthExplanation =
    sanitizeForKoreanDisplay(sdl?.product_market_fit_explanation ?? sdl?.entry_explanation)?.trim() || null
  const competitionExplanationAi = sanitizeForKoreanDisplay(sdl?.competition_explanation)?.trim() || null
  const opportunityExplanationAi =
    sanitizeForKoreanDisplay(
      km.opportunity_score_reason_text ?? sdl?.opportunity_score_reason_text ?? sdl?.market_opportunity_explanation
    )?.trim() || null

  const cards = [
    {
      id: 'market-growth',
      label: '시장 성장성',
      value: marketGrowthLabel,
      icon: TrendingUp,
      explanation:
        marketGrowthExplanation ||
        (marketGrowthLabel === '높음'
          ? '성장률·트렌드 데이터가 양호하기 때문입니다.'
          : marketGrowthLabel === '중간'
            ? '성장률이 보통 수준으로 반영되었습니다.'
            : marketGrowthLabel === '낮음'
              ? '성장률 데이터가 낮기 때문입니다.'
              : null),
    },
    {
      id: 'competition',
      label: '경쟁 강도',
      value: competitionLabel,
      icon: Shield,
      explanation:
        competitionExplanationAi ||
        (competitionLabel === '높음'
          ? '경쟁사 수가 많아 경쟁 강도가 높게 반영되었습니다.'
          : competitionLabel === '중간'
            ? '경쟁 수준이 보통으로 반영되었습니다.'
            : competitionLabel === '낮음'
              ? '경쟁사 수가 적어 경쟁 강도가 낮게 반영되었습니다.'
              : null),
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
      value: opportunityLabel,
      icon: Sparkles,
      showCalculating: loading,
      explanation:
        opportunityExplanationAi ||
        (opportunityLabel === '높음'
          ? '수요·성장·리스크 요인이 유리하게 반영되었습니다.'
          : opportunityLabel === '중간'
            ? '시장 기회가 보통 수준으로 산출되었습니다.'
            : opportunityLabel === '낮음'
              ? '수요 대비 공급이 많거나 리스크 요인이 반영되었습니다.'
              : null),
    },
  ]

  if (loading && !result) {
    return (
      <div className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
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
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {cards.map((card) => (
        <SummaryCard key={card.id} card={card} variant={variant} />
      ))}
    </div>
  )
})
