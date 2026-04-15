'use client'

import { TrendingUp, Shield, Zap, BarChart3, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { SectionContentSkeleton } from './SectionContentSkeleton'

type StrategyEval = {
  market_attractiveness?: number
  market_attractiveness_label?: string
  market_attractiveness_reason?: string
  competition_risk?: number
  competition_risk_label?: string
  competition_risk_reason?: string
  execution_difficulty?: number
  execution_difficulty_label?: string
  execution_difficulty_reason?: string
  growth_potential?: number
  growth_potential_label?: string
  growth_potential_reason?: string
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

/** 1–10 스코어를 5점 만점 별로 환산 (시각적 직관) */
function StarRow5({ score10 }: { score10: number }) {
  const filled = Math.min(5, Math.max(0, Math.round(score10 / 2)))
  return (
    <div className="mt-2 flex gap-0.5" aria-label={`5점 만점 ${filled}점`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i < filled ? 'fill-[#2AC1BC] text-[#2AC1BC]' : 'fill-none text-muted-foreground/35'
          )}
          strokeWidth={i < filled ? 0 : 1.5}
        />
      ))}
    </div>
  )
}

export interface StrategyEvaluationSectionProps {
  result: ResearchResponse | null
  loading?: boolean
  /** 상위 카드 안에 넣을 때: 외곽 섹션·이중 카드 제거 */
  embedded?: boolean
}

export function StrategyEvaluationSection({
  result,
  loading = false,
  embedded = false,
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

  const body =
    loading && !hasContent ? (
      <SectionContentSkeleton variant="grid" />
    ) : embedded ? (
      <div className="overflow-x-auto rounded-md border border-border/50">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2.5 w-[10rem]">축</th>
              <th className="whitespace-nowrap px-3 py-2.5 w-[5rem]">점수</th>
              <th className="min-w-[200px] px-3 py-2.5">시각</th>
              <th className="min-w-[220px] px-3 py-2.5">근거</th>
            </tr>
          </thead>
          <tbody>
            {DIMENSIONS.map((d) => {
              const Icon = d.icon
              const score = se && typeof se[d.id] === 'number' ? (se[d.id] as number) : null
              const reasonKey = `${d.id}_reason` as keyof StrategyEval
              const labelKey = `${d.id}_label` as keyof StrategyEval
              const reason = se && typeof se[reasonKey] === 'string' ? (se[reasonKey] as string) : null
              const label = se && typeof se[labelKey] === 'string' ? (se[labelKey] as string) : null
              return (
                <tr key={d.id} className="border-b border-border/40 last:border-b-0 hover:bg-muted/10">
                  <td className="align-top px-3 py-3">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      {d.labelKo}
                    </span>
                    {label ? <p className="mt-0.5 text-[10px] text-muted-foreground">{label}</p> : null}
                  </td>
                  <td className="align-top px-3 py-3 tabular-nums font-semibold">{score != null ? `${score}/10` : '—'}</td>
                  <td className="align-top px-3 py-3">
                    {score != null ? (
                      <div className="flex flex-col gap-1.5 max-w-[200px]">
                        <StarRow5 score10={score} />
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              d.higherIsBetter ? 'bg-[#2AC1BC]' : 'bg-amber-500'
                            )}
                            style={{ width: `${(score / 10) * 100}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="align-top px-3 py-3 text-slate-600 dark:text-zinc-400 text-xs leading-relaxed">
                    {reason ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {DIMENSIONS.map((d) => {
            const Icon = d.icon
            const score = se && typeof se[d.id] === 'number' ? (se[d.id] as number) : null
            const reasonKey = `${d.id}_reason` as keyof StrategyEval
            const labelKey = `${d.id}_label` as keyof StrategyEval
            const reason = se && typeof se[reasonKey] === 'string' ? (se[reasonKey] as string) : null
            const label = se && typeof se[labelKey] === 'string' ? (se[labelKey] as string) : null
            return (
              <div
                key={d.id}
                className={cn(
                  'rounded-xl border-2 p-4 transition-colors hover:shadow-md flex flex-col',
                  d.className
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-5 w-5 text-foreground shrink-0" aria-hidden />
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {d.labelKo}
                  </span>
                  {label && (
                    <span className="text-[10px] text-muted-foreground/80 ml-auto">{label}</span>
                  )}
                </div>
                <p className="text-2xl font-bold text-foreground leading-snug">
                  {score != null ? `${score}/10` : '—'}
                </p>
                {score != null && (
                  <>
                    <StarRow5 score10={score} />
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          d.higherIsBetter ? 'bg-[#2AC1BC]' : 'bg-amber-500'
                        )}
                        style={{ width: `${(score / 10) * 100}%` }}
                      />
                    </div>
                  </>
                )}
                {reason && (
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">이유</p>
                    <p className="text-xs text-foreground leading-relaxed">{reason}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )

  if (embedded) {
    return (
      <div id="section-strategy-evaluation" className="scroll-mt-24 space-y-2">
        <div className="px-0.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">전략 평가</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            시장 매력·경쟁 리스크·실행 난이도·성장 잠재력 (1–10)
          </p>
        </div>
        {body}
      </div>
    )
  }

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
          시장 매력·경쟁 리스크·실행 난이도·성장 잠재력 축별 1–10 스코어
        </p>
      </div>
      {body}
    </section>
  )
}
