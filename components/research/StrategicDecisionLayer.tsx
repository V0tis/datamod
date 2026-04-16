'use client'

import { TrendingUp, Shield, Target, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { SectionContentSkeleton } from './SectionContentSkeleton'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { MarkdownBody } from '@/components/ui/markdown-body'

function competitionToLabel(v: 'low' | 'medium' | 'high' | undefined): string {
  if (v === 'low') return '낮음'
  if (v === 'medium') return '보통'
  if (v === 'high') return '높음'
  return '데이터 없음'
}

function pmfToLabel(v: 'low' | 'medium' | 'high' | undefined): string {
  if (v === 'low') return '낮음'
  if (v === 'medium') return '보통'
  if (v === 'high') return '높음'
  return '데이터 없음'
}

export interface StrategicDecisionLayerProps {
  result: ResearchResponse | null
  loading?: boolean
  keyword?: string
  /** When true, renders without outer card wrapper (for use inside ResultPageSection) */
  embedded?: boolean
  /** embedded 전용: 카드 그리드 대신 단일 테이블 */
  flatTable?: boolean
}

export function StrategicDecisionLayer({
  result,
  loading = false,
  embedded = false,
  flatTable = true,
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
    sanitizeForKoreanDisplay(
      km.opportunity_score_reason_text ?? sdl?.opportunity_score_reason_text ?? sdl?.market_opportunity_explanation
    ) || null
  const competitionExplanation = sanitizeForKoreanDisplay(sdl?.competition_explanation) || null
  const productMarketFit = sdl?.product_market_fit
  const productMarketFitExplanation = sanitizeForKoreanDisplay(sdl?.product_market_fit_explanation) || null
  const entryStrategy = sanitizeForKoreanDisplay(sdl?.entry_strategy) || null
  const entryExplanation = sanitizeForKoreanDisplay(sdl?.entry_explanation) || null

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
      label: '시장 기회도',
      value: loading && opportunityScore == null ? '산출 중...' : (opportunityScore != null ? `${opportunityScore}/100` : '데이터 없음'),
      explanation: marketOpportunityExplanation,
      className: 'border-emerald-500/30 bg-emerald-500/5',
    },
    {
      id: 'competition',
      icon: Shield,
      label: '경쟁 강도',
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
      label: '제품-시장 적합성',
      value: pmfToLabel(productMarketFit),
      explanation: productMarketFitExplanation,
      className: 'border-primary/30 bg-primary/5',
    },
    {
      id: 'entry',
      icon: Clock,
      label: '진입 전략',
      value: entryStrategy ?? '데이터 없음',
      explanation: entryExplanation,
      className: 'border-blue-500/30 bg-blue-500/5',
    },
  ]

  if (embedded) {
    return loading && !hasContent ? (
      <SectionContentSkeleton variant="grid" />
    ) : flatTable ? (
      <div className="overflow-x-auto rounded-md border border-border/50">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2.5 w-[9rem]">영역</th>
              <th className="whitespace-nowrap px-3 py-2.5 w-[8rem]">요약</th>
              <th className="min-w-[240px] px-3 py-2.5">근거·해석</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((card) => {
              const Icon = card.icon
              return (
                <tr key={card.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/10">
                  <td className="align-top px-3 py-3">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      {card.label}
                    </span>
                  </td>
                  <td className="align-top px-3 py-3 font-semibold tabular-nums text-foreground">{card.value}</td>
                  <td className="align-top px-3 py-3 text-slate-600 dark:text-zinc-400">
                    {card.explanation ? (
                      <MarkdownBody className="prose-base max-w-none text-sm leading-relaxed text-inherit [&_p]:my-0">
                        {card.explanation}
                      </MarkdownBody>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div
              key={card.id}
              className={cn('rounded-lg border-2 p-3 transition-colors hover:shadow-md', card.className)}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-foreground shrink-0" aria-hidden />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-base font-bold text-foreground leading-snug mb-1">{card.value}</p>
              {card.explanation && (
                <MarkdownBody className="prose-base text-sm leading-relaxed text-muted-foreground">
                  {card.explanation}
                </MarkdownBody>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <section
      id="section-strategic-decision"
      className="scroll-mt-24 rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          전략적 의사결정 레이어
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
                  <MarkdownBody className="prose-base text-sm leading-relaxed text-muted-foreground">
                    {card.explanation}
                  </MarkdownBody>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
