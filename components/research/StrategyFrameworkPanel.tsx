'use client'

import { useMemo } from 'react'
import { AlertTriangle, Info, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import {
  enrichPorter5Forces,
  resolveJtbdTriad,
  type Porter5ForcesShape,
  type PorterFiveScores,
} from '@/lib/strategy-framework-mapper'
import { porterFiveScoreTo10 } from '@/lib/score-display'
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
  'Porter 5 Forces 가로 막대입니다. 내부 원천은 1~5 척도를 쓰며, 화면에는 /10으로 환산해 표시합니다. 높을수록 해당 힘이 강합니다.'

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
        const v10 = porterFiveScoreTo10(row.v)
        const pct = Math.min(100, Math.max(0, (v10 / 10) * 100))
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
              <span className="w-10 shrink-0 tabular-nums text-right text-[11px] font-medium text-foreground">
                {v10}/10
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
  if (items.length === 0) return null
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

function SwotMatrixList({ items, dotClass, textClass }: { items: string[]; dotClass: string; textClass: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">해당 항목 없음</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((s, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} aria-hidden />
          <span className={cn('text-sm leading-relaxed', textClass)}>{s}</span>
        </li>
      ))}
    </ul>
  )
}

function SwotMatrix({ swot }: { swot: NonNullable<SwotShape> }) {
  const strengths = swot.strengths ?? []
  const weaknesses = swot.weaknesses ?? []
  const opportunities = swot.opportunities ?? []
  const threats = swot.threats ?? []

  return (
    <div className="relative pt-5">
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 whitespace-nowrap text-[11px] text-gray-400 dark:text-zinc-500">
        내부 요인 ← → 외부 요인
      </div>
      <div className="grid grid-cols-2 gap-0.5 overflow-hidden rounded-xl border border-gray-200 dark:border-zinc-700">
        <div className="bg-emerald-50 p-4 dark:bg-emerald-950/35">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500">
              <TrendingUp className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">강점 (S)</span>
          </div>
          <SwotMatrixList items={strengths} dotClass="bg-emerald-400" textClass="text-emerald-900 dark:text-emerald-100" />
        </div>
        <div className="bg-red-50 p-4 dark:bg-red-950/30">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-red-500">
              <TrendingDown className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-red-800 dark:text-red-200">약점 (W)</span>
          </div>
          <SwotMatrixList items={weaknesses} dotClass="bg-red-400" textClass="text-red-900 dark:text-red-100" />
        </div>
        <div className="bg-blue-50 p-4 dark:bg-blue-950/35">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500">
              <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-blue-800 dark:text-blue-200">기회 (O)</span>
          </div>
          <SwotMatrixList items={opportunities} dotClass="bg-blue-400" textClass="text-blue-900 dark:text-blue-100" />
        </div>
        <div className="bg-amber-50 p-4 dark:bg-amber-950/30">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500">
              <AlertTriangle className="h-3.5 w-3.5 text-white" aria-hidden />
            </span>
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">위협 (T)</span>
          </div>
          <SwotMatrixList items={threats} dotClass="bg-amber-400" textClass="text-amber-950 dark:text-amber-100" />
        </div>
      </div>
    </div>
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

  const hasFullFrameworkContent = hasSwot || hasJtbd || hasPorterChart
  if (!summaryRadarOnly && !hasFullFrameworkContent) return null

  if (summaryRadarOnly) {
    return (
      <div
        key={instanceKey}
        className={cn(
          'rounded-xl border border-slate-100 bg-white shadow-none dark:border-zinc-800 dark:bg-zinc-950',
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
        {hasSwot ? (
          <section id="report-framework-swot" className="scroll-mt-24">
            <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">SWOT</h4>
            <SwotMatrix swot={swot!} />
          </section>
        ) : null}

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

        {hasJtbd ? (
          <section id="report-framework-jtbd" className="scroll-mt-24 border-t border-slate-100 pt-8 dark:border-zinc-800">
            <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">JTBD</h4>
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
          </section>
        ) : null}
      </div>
    </div>
  )
}
