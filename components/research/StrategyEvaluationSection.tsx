'use client'

import { TrendingUp, Shield, Zap, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { SectionContentSkeleton } from './SectionContentSkeleton'

type StrategyEval = {
  market_attractiveness?: number
  competition_risk?: number
  execution_difficulty?: number
  growth_potential?: number
}

const DIMENSIONS = [
  {
    id: 'market_attractiveness' as const,
    label: 'Market Attractiveness',
    labelKo: '시장 매력도',
    icon: TrendingUp,
    higherIsBetter: true,
    className: 'border-emerald-500/30 bg-emerald-500/5',
  },
  {
    id: 'competition_risk' as const,
    label: 'Competition Risk',
    labelKo: '경쟁 리스크',
    icon: Shield,
    higherIsBetter: false,
    className: 'border-amber-500/30 bg-amber-500/5',
  },
  {
    id: 'execution_difficulty' as const,
    label: 'Execution Difficulty',
    labelKo: '실행 난이도',
    icon: Zap,
    higherIsBetter: false,
    className: 'border-orange-500/30 bg-orange-500/5',
  },
  {
    id: 'growth_potential' as const,
    label: 'Growth Potential',
    labelKo: '성장 잠재력',
    icon: BarChart3,
    higherIsBetter: true,
    className: 'border-primary/30 bg-primary/5',
  },
]

export interface StrategyEvaluationSectionProps {
  result: ResearchResponse | null
  loading?: boolean
}

export function StrategyEvaluationSection({
  result,
  loading = false,
}: StrategyEvaluationSectionProps) {
  const km = result?.key_metrics ?? {}
  const se = (km as { strategy_evaluation?: StrategyEval }).strategy_evaluation

  const hasContent =
    se &&
    (typeof se.market_attractiveness === 'number' ||
      typeof se.competition_risk === 'number' ||
      typeof se.execution_difficulty === 'number' ||
      typeof se.growth_potential === 'number')

  if (!hasContent && !loading) return null

  return (
    <section
      id="section-strategy-evaluation"
      className="scroll-mt-24 rounded-xl border border-border bg-card overflow-hidden"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-border/60">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          전략 평가
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          AI가 생성된 전략을 평가한 1–10 점수
        </p>
      </div>
      {loading && !hasContent ? (
        <div className="p-4 sm:p-5">
          <SectionContentSkeleton variant="grid" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-5">
          {DIMENSIONS.map((d) => {
            const Icon = d.icon
            const score = se && typeof se[d.id] === 'number' ? (se[d.id] as number) : null
            return (
              <div
                key={d.id}
                className={cn(
                  'rounded-xl border-2 p-4 transition-colors hover:shadow-md',
                  d.className
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-foreground shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {d.labelKo}
                  </span>
                </div>
                <p className="text-2xl font-bold text-foreground leading-snug">
                  {score != null ? `${score}/10` : '—'}
                </p>
                {score != null && (
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        d.higherIsBetter
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      )}
                      style={{ width: `${(score / 10) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
