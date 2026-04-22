'use client'

import { TrendingUp, Shield, Zap, BarChart3, Scale, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { SectionContentSkeleton } from './SectionContentSkeleton'

type StrategyEval = {
  cross_validation_score?: number
  cross_validation_summary?: string
  risk_items?: Array<{ issue: string; mitigation_level: string; plan: string }>
  opportunity_items?: Array<{ value: string; difficulty_level: string; priority: number }>
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
    label: '시장 매력도',
    labelKo: '시장 매력도',
    icon: TrendingUp,
    higherIsBetter: true,
    className: 'border-emerald-500/30 bg-emerald-500/5',
  },
  {
    id: 'competition_risk' as const,
    label: '경쟁 리스크',
    labelKo: '경쟁 리스크',
    icon: Shield,
    higherIsBetter: false,
    className: 'border-amber-500/30 bg-amber-500/5',
  },
  {
    id: 'execution_difficulty' as const,
    label: '실행 난이도',
    labelKo: '실행 난이도',
    icon: Zap,
    higherIsBetter: false,
    className: 'border-orange-500/30 bg-orange-500/5',
  },
  {
    id: 'growth_potential' as const,
    label: '성장 잠재력',
    labelKo: '성장 잠재력',
    icon: BarChart3,
    higherIsBetter: true,
    className: 'border-primary/30 bg-primary/5',
  },
]

function MitigationBadge({ level }: { level: string }) {
  const n = level.trim()
  const variant =
    n === '상' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' : n === '하' ? 'bg-destructive/10 text-destructive border-destructive/35' : 'bg-amber-500/12 text-amber-800 dark:text-amber-200 border-amber-500/35'
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', variant)}>
      완화 {n || '중'}
    </span>
  )
}

function DifficultyBadge({ level }: { level: string }) {
  const n = level.trim()
  const variant =
    n === '저' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' : n === '고' ? 'bg-destructive/10 text-destructive border-destructive/35' : 'bg-amber-500/12 text-amber-800 dark:text-amber-200 border-amber-500/35'
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', variant)}>
      실행난이도 {n || '중'}
    </span>
  )
}

function ScoreBar10({
  score10,
  higherIsBetter,
}: {
  score10: number
  higherIsBetter: boolean
}) {
  const pct = Math.min(100, Math.max(0, (score10 / 10) * 100))
  const barClass = higherIsBetter ? 'bg-[#2AC1BC]' : 'bg-amber-500'
  return (
    <div className="flex items-center gap-2 w-full max-w-[220px]">
      <div className="h-1.5 min-w-[5rem] flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', barClass)} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{score10}/10</span>
    </div>
  )
}

function CrossValidationHeader({ score, summary }: { score: number; summary?: string | null }) {
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Scale className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-sm font-semibold text-foreground">
          교차검증 결과 이 전략은 <span className="tabular-nums text-primary">{score}%</span> 신뢰도로 판단됩니다.
        </p>
      </div>
      {summary ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{summary}</p> : null}
    </div>
  )
}

function RiskOpportunityLists({ se }: { se: StrategyEval }) {
  const risks = se.risk_items ?? []
  const opps = se.opportunity_items ?? []
  if (!risks.length && !opps.length) return null
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {risks.length > 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">리스크 · 완화 설계</h3>
          </div>
          <ul className="space-y-3">
            {risks.map((r, i) => (
              <li key={`r-${i}`} className="rounded-md border border-border/50 bg-card/60 p-3 text-xs leading-relaxed">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-foreground">{r.issue}</p>
                  <MitigationBadge level={r.mitigation_level} />
                </div>
                <p className="mt-2 text-muted-foreground">{r.plan}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {opps.length > 0 ? (
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" aria-hidden />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">기회 · 실행 난이도 · 우선순위</h3>
          </div>
          <ul className="space-y-3">
            {opps.map((o, i) => (
              <li key={`o-${i}`} className="rounded-md border border-border/50 bg-card/60 p-3 text-xs leading-relaxed">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-foreground">
                    <span className="mr-1.5 tabular-nums text-muted-foreground">P{o.priority}</span>
                    {o.value}
                  </p>
                  <DifficultyBadge level={o.difficulty_level} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export interface StrategyEvaluationSectionProps {
  result: ResearchResponse | null
  loading?: boolean
  /** 상위 카드 안에 넣을 때: 외곽 섹션·이중 카드 제거 */
  embedded?: boolean
  /** embedded일 때 상단 제목·설명 줄 숨김(상위 섹션에서 이미 표시할 때) */
  showEmbeddedHeading?: boolean
}

export function StrategyEvaluationSection({
  result,
  loading = false,
  embedded = false,
  showEmbeddedHeading = true,
}: StrategyEvaluationSectionProps) {
  const km = result?.key_metrics ?? {}
  const se = (km as { strategy_evaluation?: StrategyEval }).strategy_evaluation

  const hasDimensionScores =
    se &&
    (typeof se.market_attractiveness === 'number' ||
      typeof se.competition_risk === 'number' ||
      typeof se.execution_difficulty === 'number' ||
      typeof se.growth_potential === 'number')

  const hasCrossBlock = typeof se?.cross_validation_score === 'number'
  const hasRoLists = !!(se?.risk_items?.length || se?.opportunity_items?.length)
  const hasContent = !!(hasDimensionScores || hasCrossBlock || hasRoLists)

  if (!hasContent && !loading) return null

  const cvScore = typeof se?.cross_validation_score === 'number' ? se.cross_validation_score : null

  const body =
    loading && !hasContent ? (
      <SectionContentSkeleton variant="grid" />
    ) : embedded ? (
      <div className="space-y-4">
        {cvScore != null ? (
          <CrossValidationHeader score={cvScore} summary={se?.cross_validation_summary} />
        ) : null}
        <RiskOpportunityLists se={se ?? {}} />
        {hasDimensionScores ? (
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
                        {score != null ? <ScoreBar10 score10={score} higherIsBetter={d.higherIsBetter} /> : <span className="text-muted-foreground">—</span>}
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
        ) : null}
      </div>
    ) : (
      <div className="p-4 sm:p-5 space-y-4">
        {cvScore != null ? (
          <CrossValidationHeader score={cvScore} summary={se?.cross_validation_summary} />
        ) : null}
        <RiskOpportunityLists se={se ?? {}} />
        {hasDimensionScores ? (
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
                    <div className="mt-2">
                      <ScoreBar10 score10={score} higherIsBetter={d.higherIsBetter} />
                    </div>
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
        ) : null}
      </div>
    )

  if (embedded) {
    return (
      <div id="section-strategy-evaluation" className="scroll-mt-24 space-y-2">
        {showEmbeddedHeading ? (
          <div className="px-0.5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">리스크 및 기회 평가</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              정량·정성 교차검증 신뢰도, 리스크 완화·기회 실행 난이도, 축별 스코어(1–10)
            </p>
          </div>
        ) : null}
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
          리스크 및 기회 평가
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          교차검증 신뢰도, 리스크 완화 가능성·대응, 기회 실행 난이도·우선순위, 축별 1–10 스코어
        </p>
      </div>
      {body}
    </section>
  )
}

/** 프롬프트/기획 문서상 이름과 맞춘 별칭 (동일 UI) */
export const RiskOpportunitySection = StrategyEvaluationSection
