'use client'

import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import {
  enrichPorter5Forces,
  resolveJtbdTriad,
  type Porter5ForcesShape,
  type PorterFiveScores,
} from '@/lib/strategy-framework-mapper'
import type { ResearchResponse } from '@/lib/stores/research-store'
import {
  Tooltip as InfoTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

type SwotShape = NonNullable<ResearchResponse['key_metrics']>['swot_analysis']
type JtbdShape = NonNullable<ResearchResponse['key_metrics']>['jtbd']

const PORTER_BAR_FILL = 'hsl(199 89% 48%)'

const PORTER_CHART_INFO_TOOLTIP =
  'Porter 5 Forces 가로 막대입니다. 점수는 AI 추정(1~5)과 기회 점수 breakdown, 경쟁 강도, 전략 평가를 합성합니다. 높을수록 해당 힘이 강합니다. 막대 옆 문구는 AI·시장 신호에서 도출한 핵심 근거(또는 신호 부족 시 추정 설명)입니다.'

function clampPorterInt(v: number): number {
  const n = Math.round(Number.isFinite(v) ? v : 0)
  return Math.min(5, Math.max(0, n))
}

type PorterNarrativeKey = keyof Pick<
  Porter5ForcesShape,
  'new_entrants' | 'supplier_power' | 'buyer_power' | 'substitutes' | 'rivalry'
>

function truncateInsight(s: string, max = 132): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function porterSyntheticReason(key: PorterNarrativeKey, score: number): string {
  const hi = score >= 4
  const lo = score <= 2
  const band = hi ? '높은 수준' : lo ? '낮은 편' : '중간 수준'
  switch (key) {
    case 'new_entrants':
      return `시장 매력·장벽·경쟁 신호 기준 신규 진입·모방 압력이 ${band}으로 추정됩니다.`
    case 'supplier_power':
      return `원자재·API·인력 등 공급 측 교섭력이 ${band}으로 보입니다.`
    case 'buyer_power':
      return `대안 비교·가격 민감도 등 구매자 교섭력이 ${band}입니다.`
    case 'substitutes':
      return `대체 재화·서비스로의 전환 압력이 ${band}으로 해석됩니다.`
    case 'rivalry':
      return `기존 경쟁사 간 경쟁 강도가 ${band}입니다.`
    default:
      return `${band} 압력으로 추정됩니다.`
  }
}

function porterReasonLine(porter: Porter5ForcesShape, key: PorterNarrativeKey, score: number): string {
  const raw = porter[key]
  const first =
    Array.isArray(raw) && raw.length
      ? raw.map((s) => (typeof s === 'string' ? s.trim() : '')).find((s) => s.length > 0)
      : undefined
  if (first) return truncateInsight(first)
  return porterSyntheticReason(key, score)
}

/** 가로 멀티 막대 + 힘별 핵심 근거 1줄 */
function PorterHorizontalMultiBar({
  scores,
  porter,
}: {
  scores: PorterFiveScores
  porter: Porter5ForcesShape
}) {
  const rows: { key: PorterNarrativeKey; label: string; v: number }[] = [
    { key: 'new_entrants', label: '진입 위협', v: clampPorterInt(scores.new_entrants) },
    { key: 'supplier_power', label: '공급자', v: clampPorterInt(scores.supplier_power) },
    { key: 'buyer_power', label: '구매자', v: clampPorterInt(scores.buyer_power) },
    { key: 'substitutes', label: '대체재', v: clampPorterInt(scores.substitutes) },
    { key: 'rivalry', label: '경쟁', v: clampPorterInt(scores.rivalry) },
  ]
  return (
    <div className="mt-3 w-full min-w-0 space-y-3.5" role="img" aria-label="Porter 5 Forces 가로 막대">
      {rows.map((row) => {
        const pct = Math.min(100, Math.max(0, (row.v / 5) * 100))
        const reason = porterReasonLine(porter, row.key, row.v)
        return (
          <div
            key={row.key}
            className="flex flex-col gap-1.5 border-b border-border/40 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-[min(100%,20rem)]">
              <span className="w-[4.25rem] shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {row.label}
              </span>
              <div className="relative h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/80">
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: PORTER_BAR_FILL }}
                />
              </div>
              <span className="w-9 shrink-0 tabular-nums text-right text-[11px] font-medium text-foreground">
                {row.v}/5
              </span>
            </div>
            <p className="min-w-0 flex-[1.2] text-xs leading-relaxed text-slate-600 dark:text-zinc-400 sm:pt-0.5">
              {reason}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function BulletList({ items, bulletClass }: { items: string[]; bulletClass: string }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">항목이 없습니다.</p>
  return (
    <ul className="list-none space-y-1.5 pl-0 text-sm">
      {items.map((s, i) => (
        <li key={i} className="flex gap-2">
          <span className={cn('shrink-0', bulletClass)}>•</span>
          <span className="text-foreground leading-relaxed">{s}</span>
        </li>
      ))}
    </ul>
  )
}

export type StrategyFrameworkPanelProps = {
  swot: SwotShape | null | undefined
  jtbd: JtbdShape | null | undefined
  porter: Porter5ForcesShape | null | undefined
  opportunityBreakdown?: {
    market_growth?: number
    competition_density?: number
    trend_momentum?: number
    funding_signals?: number
    risk_factors?: number
  }
  strategicDecisionLayer?: {
    competition_intensity?: 'low' | 'medium' | 'high'
  } | null
  strategyEvaluation?: {
    competition_risk?: number
    growth_potential?: number
    market_attractiveness?: number
  } | null
  /** 리포트 전환 시 하위 트리 리셋용 */
  instanceKey?: string
  className?: string
  /** 요약 영역: Porter 5 Forces 차트만 표시 (SWOT/JTBD·서술 제외) */
  summaryRadarOnly?: boolean
}

export function StrategyFrameworkPanel({
  swot,
  jtbd,
  porter,
  opportunityBreakdown,
  strategicDecisionLayer,
  strategyEvaluation,
  instanceKey = 'default',
  className,
  summaryRadarOnly = false,
}: StrategyFrameworkPanelProps) {
  const porterMerged = useMemo(
    () =>
      enrichPorter5Forces(
        porter ?? undefined,
        opportunityBreakdown ?? undefined,
        strategicDecisionLayer ?? undefined,
        strategyEvaluation ?? undefined
      ),
    [porter, opportunityBreakdown, strategicDecisionLayer, strategyEvaluation]
  )

  const scores = porterMerged.scores as PorterFiveScores | undefined
  const hasSwot =
    !!swot &&
    !!(swot.strengths?.length || swot.weaknesses?.length || swot.opportunities?.length || swot.threats?.length)
  const jtbdTriad = useMemo(() => resolveJtbdTriad(jtbd ?? undefined), [jtbd])
  const hasJtbd =
    jtbdTriad.functional.length + jtbdTriad.social.length + jtbdTriad.emotional.length > 0
  const hasPorterChart = scores != null && Object.values(scores).every((n) => typeof n === 'number')

  if (summaryRadarOnly) {
    return (
      <div
        key={instanceKey}
        className={cn(
          'rounded-xl border border-slate-100 bg-card shadow-none dark:border-zinc-800 dark:bg-zinc-900',
          className
        )}
      >
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5 dark:border-zinc-800">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">제품 전략 프레임워크</h3>
              <InfoTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Porter 5 Forces 차트 설명"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                  {PORTER_CHART_INFO_TOOLTIP}
                </TooltipContent>
              </InfoTooltip>
            </div>
          </TooltipProvider>
        </div>
        <div className="space-y-3 overflow-hidden p-3 sm:p-4">
          {hasPorterChart && scores ? (
            <>
              <PorterHorizontalMultiBar scores={scores} porter={porterMerged} />
              <ChartSourceFooter />
            </>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              전략 프레임워크 점수를 계산할 시장 지표가 아직 부족합니다. 아래 전략 섹션에서 상세 프레임워크를 확인하세요.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div key={instanceKey} className={cn('rounded-xl border border-slate-100 bg-card dark:border-zinc-800', className)}>
      <div className="space-y-10 p-4 sm:p-5">
        <section id="report-framework-swot" className="scroll-mt-24">
          <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">SWOT</h4>
          {!hasSwot ? (
            <p className="text-sm text-muted-foreground">SWOT 데이터가 없습니다.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {swot!.strengths?.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">강점</p>
                  <BulletList items={swot!.strengths!} bulletClass="text-emerald-500" />
                </div>
              ) : null}
              {swot!.weaknesses?.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">약점</p>
                  <BulletList items={swot!.weaknesses!} bulletClass="text-amber-500" />
                </div>
              ) : null}
              {swot!.opportunities?.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">기회</p>
                  <BulletList items={swot!.opportunities!} bulletClass="text-blue-500" />
                </div>
              ) : null}
              {swot!.threats?.length ? (
                <div>
                  <p className="mb-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">위협</p>
                  <BulletList items={swot!.threats!} bulletClass="text-rose-500" />
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section id="report-framework-porter" className="scroll-mt-24 border-t border-slate-100 pt-8 dark:border-zinc-800">
          <TooltipProvider delayDuration={200}>
            <div className="mb-3 flex items-center gap-2">
              <h4 className="text-sm font-semibold tracking-tight text-foreground">Porter 5 Forces</h4>
              <InfoTooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Porter 5 Forces 설명"
                  >
                    <Info className="h-4 w-4" aria-hidden />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                  {PORTER_CHART_INFO_TOOLTIP}
                </TooltipContent>
              </InfoTooltip>
            </div>
          </TooltipProvider>
          {hasPorterChart && scores ? (
            <>
              <PorterHorizontalMultiBar scores={scores} porter={porterMerged} />
              <ChartSourceFooter />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">점수를 계산할 시장 지표가 부족합니다.</p>
          )}
        </section>

        <section id="report-framework-jtbd" className="scroll-mt-24 border-t border-slate-100 pt-8 dark:border-zinc-800">
          <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">JTBD</h4>
          {!hasJtbd ? (
            <p className="text-sm text-muted-foreground">JTBD 데이터가 없습니다.</p>
          ) : (
            <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
              <div className="border-b border-border/50 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">기능적 (Functional)</p>
                <p className="mb-2 text-[11px] text-muted-foreground">업무·효율·성과로 측정되는 핵심 과제</p>
                <BulletList items={jtbdTriad.functional} bulletClass="text-sky-500" />
              </div>
              <div className="border-b border-border/50 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6">
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">사회적 (Social)</p>
                <p className="mb-2 text-[11px] text-muted-foreground">타인·조직·규범과의 관계에서의 니즈</p>
                <BulletList items={jtbdTriad.social} bulletClass="text-violet-500" />
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">정서적 (Emotional)</p>
                <p className="mb-2 text-[11px] text-muted-foreground">불안 완화·자신감·만족 등 정서 동기</p>
                <BulletList items={jtbdTriad.emotional} bulletClass="text-rose-500" />
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
