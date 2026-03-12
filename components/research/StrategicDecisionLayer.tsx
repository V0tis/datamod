'use client'

import { TrendingUp, Shield, Target, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { SectionContentSkeleton } from './SectionContentSkeleton'

function competitionToLabel(v: 'low' | 'medium' | 'high' | undefined): string {
  if (v === 'low') return 'Low'
  if (v === 'medium') return 'Medium'
  if (v === 'high') return 'High'
  return '—'
}

function pmfToLabel(v: 'low' | 'medium' | 'high' | undefined): string {
  if (v === 'low') return '낮음'
  if (v === 'medium') return '보통'
  if (v === 'high') return '높음'
  return '—'
}

export interface StrategicDecisionLayerProps {
  result: ResearchResponse | null
  loading?: boolean
  keyword?: string
}

export function StrategicDecisionLayer({
  result,
  loading = false,
}: StrategicDecisionLayerProps) {
  const km = result?.key_metrics ?? {}
  const sdl = km.strategic_decision_layer
  const breakdown = km.opportunity_score_breakdown ?? {}
  const opportunityScore = typeof km.opportunity_score === 'number' ? km.opportunity_score : null
  const competitionDensity = typeof breakdown.competition_density === 'number' ? breakdown.competition_density : null
  const competitionPressure = typeof breakdown.competition_pressure === 'number' ? breakdown.competition_pressure : null

  // Derive competition intensity when AI didn't provide it
  const competitionIntensity =
    sdl?.competition_intensity ??
    (competitionDensity != null
      ? Math.abs(competitionDensity) > 15
        ? 'high'
        : Math.abs(competitionDensity) > 5
          ? 'medium'
          : 'low'
      : competitionPressure != null
        ? competitionPressure >= 70
          ? 'high'
          : competitionPressure >= 40
            ? 'medium'
            : 'low'
        : undefined)

  const marketOpportunityExplanation =
    sdl?.market_opportunity_explanation ?? km.opportunity_score_reasoning ?? null
  const competitionExplanation = sdl?.competition_explanation ?? null
  const productMarketFit = sdl?.product_market_fit
  const productMarketFitExplanation = sdl?.product_market_fit_explanation ?? null
  const entryStrategy = sdl?.entry_strategy ?? null
  const entryExplanation = sdl?.entry_explanation ?? null

  const hasContent =
    opportunityScore != null ||
    competitionIntensity ||
    productMarketFit ||
    entryStrategy ||
    marketOpportunityExplanation ||
    competitionExplanation ||
    productMarketFitExplanation ||
    entryExplanation

  if (!hasContent && !loading) return null

  const cards = [
    {
      id: 'market-opportunity',
      icon: TrendingUp,
      label: 'Market Opportunity',
      value: loading && opportunityScore == null ? '산출 중...' : (opportunityScore != null ? `${opportunityScore}/100` : '—'),
      explanation: marketOpportunityExplanation,
      className: 'border-emerald-500/30 bg-emerald-500/5',
    },
    {
      id: 'competition',
      icon: Shield,
      label: 'Competition Intensity',
      value: competitionToLabel(competitionIntensity),
      explanation: competitionExplanation,
      className:
        competitionIntensity === 'high'
          ? 'border-destructive/30 bg-destructive/5'
          : competitionIntensity === 'medium'
            ? 'border-amber-500/30 bg-amber-500/5'
            : 'border-emerald-500/30 bg-emerald-500/5',
    },
    {
      id: 'pmf',
      icon: Target,
      label: 'Product-Market Fit Potential',
      value: pmfToLabel(productMarketFit),
      explanation: productMarketFitExplanation,
      className: 'border-primary/30 bg-primary/5',
    },
    {
      id: 'entry',
      icon: Clock,
      label: 'Entry Strategy',
      value: entryStrategy ?? '—',
      explanation: entryExplanation,
      className: 'border-blue-500/30 bg-blue-500/5',
    },
  ]

  return (
    <section
      id="section-strategic-decision"
      className="scroll-mt-24 rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Strategic Decision Layer
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          시장 기회, 경쟁 강도, PMF 잠재력, 진입 전략 요약
        </p>
      </div>
      {loading && !hasContent ? (
        <div className="p-4 sm:p-5">
          <SectionContentSkeleton variant="grid" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-5">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div
                key={card.id}
                className={cn(
                  'rounded-xl border-2 p-4 transition-colors hover:shadow-md',
                  card.className
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-foreground shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {card.label}
                  </span>
                </div>
                <p className="text-lg font-bold text-foreground leading-snug mb-2">
                  {card.value}
                </p>
                {card.explanation && (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.explanation}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
