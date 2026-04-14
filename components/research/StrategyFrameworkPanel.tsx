'use client'

import { useMemo } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { RadarAngleEllipsisTick } from '@/components/analysis/radar-angle-tick'
import {
  enrichPorter5Forces,
  resolveJtbdTriad,
  type Porter5ForcesShape,
  type PorterFiveScores,
} from '@/lib/strategy-framework-mapper'
import type { ResearchResponse } from '@/lib/stores/research-store'

type SwotShape = NonNullable<ResearchResponse['key_metrics']>['swot_analysis']
type JtbdShape = NonNullable<ResearchResponse['key_metrics']>['jtbd']

const CHART_GRID = 'hsl(var(--border))'
const CHART_AXIS = 'hsl(var(--muted-foreground))'
const CHART_FILL = 'hsl(199 89% 48%)'
const CHART_STROKE = 'hsl(199 89% 40%)'

/** 레이블 여유: 위젯 밖으로 텍스트가 나가지 않도록 Recharts margin 최소 40px */
const PORTER_RADAR_MARGIN = { top: 40, right: 44, bottom: 40, left: 44 } as const

function PorterBars({ scores }: { scores: PorterFiveScores }) {
  const rows = [
    { name: '진입 위협', v: scores.new_entrants },
    { name: '공급자', v: scores.supplier_power },
    { name: '구매자', v: scores.buyer_power },
    { name: '대체재', v: scores.substitutes },
    { name: '경쟁', v: scores.rivalry },
  ]
  return (
    <div className="mt-4 h-[200px] w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
          <XAxis type="number" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fontSize: 10, fill: CHART_AXIS }} />
          <YAxis type="category" dataKey="name" width={56} tick={{ fontSize: 10, fill: CHART_AXIS }} />
          <Tooltip
            formatter={(v: number) => [`${v}/5`, '강도']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
          />
          <Bar dataKey="v" fill={CHART_FILL} radius={[0, 4, 4, 0]} maxBarSize={14} name="점수" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function clampPorterInt(v: number): number {
  const n = Math.round(Number.isFinite(v) ? v : 0)
  return Math.min(5, Math.max(0, n))
}

/** 0이면 레이더가 중앙에 붙지 않도록 표시값만 최소 1로 올림(툴팁은 원점수). */
function porterRadarRow(subject: string, value: number) {
  const raw = clampPorterInt(value)
  const display = raw === 0 ? 1 : raw
  return { subject, score: display, rawScore: raw, fullMark: 5 }
}

function PorterRadar({ scores }: { scores: PorterFiveScores }) {
  const data = [
    porterRadarRow('진입 위협', scores.new_entrants),
    porterRadarRow('공급자', scores.supplier_power),
    porterRadarRow('구매자', scores.buyer_power),
    porterRadarRow('대체재', scores.substitutes),
    porterRadarRow('경쟁', scores.rivalry),
  ]
  return (
    <div className="mx-auto w-full max-w-[380px] min-h-[280px] min-w-[220px] px-2 py-3">
      <ResponsiveContainer width="100%" height="100%" minWidth={220} minHeight={280} debounce={32}>
        <RadarChart
          cx="50%"
          cy="50%"
          outerRadius="58%"
          margin={PORTER_RADAR_MARGIN}
          data={data}
        >
          <PolarGrid stroke={CHART_GRID} />
          <PolarAngleAxis
            dataKey="subject"
            tick={(p) => <RadarAngleEllipsisTick {...p} fill={CHART_AXIS} maxLen={8} />}
          />
          <PolarRadiusAxis angle={30} domain={[0, 5]} tickCount={6} tick={{ fontSize: 9, fill: CHART_AXIS }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as { subject?: string; rawScore?: number }
              return (
                <div
                  className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-md"
                  style={{ fontSize: 12 }}
                >
                  <p className="font-medium text-foreground">{row.subject}</p>
                  <p className="tabular-nums text-muted-foreground">
                    {typeof row.rawScore === 'number' ? `${row.rawScore}/5` : '—'} (강도)
                  </p>
                </div>
              )
            }}
          />
          <Radar name="5 Forces" dataKey="score" stroke={CHART_STROKE} fill={CHART_FILL} fillOpacity={0.35} strokeWidth={2} />
        </RadarChart>
      </ResponsiveContainer>
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

function PorterNarratives({ porter }: { porter: Porter5ForcesShape }) {
  const blocks: { title: string; items: string[]; color: string }[] = [
    { title: '진입 위협', items: porter.new_entrants ?? [], color: 'text-sky-600 dark:text-sky-400' },
    { title: '공급자 교섭력', items: porter.supplier_power ?? [], color: 'text-violet-600 dark:text-violet-400' },
    { title: '구매자 교섭력', items: porter.buyer_power ?? [], color: 'text-amber-600 dark:text-amber-400' },
    { title: '대체재 위협', items: porter.substitutes ?? [], color: 'text-orange-600 dark:text-orange-400' },
    { title: '기존 경쟁', items: porter.rivalry ?? [], color: 'text-rose-600 dark:text-rose-400' },
  ].filter((b) => b.items.length > 0)
  if (blocks.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        AI·시장 지표 기반 점수만 표시됩니다. 서술형 근거는 다음 분석부터 porter_5_forces 배열로 채워집니다.
      </p>
    )
  }
  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-4">
      {blocks.map((b) => (
        <div key={b.title}>
          <p className={cn('mb-1 text-[11px] font-semibold uppercase tracking-wider', b.color)}>{b.title}</p>
          <BulletList items={b.items} bulletClass="text-muted-foreground" />
        </div>
      ))}
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

  return (
    <div key={instanceKey} className={cn('rounded-xl border border-border/60 bg-card', className)}>
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

        <section id="report-framework-porter" className="scroll-mt-24 border-t border-border/50 pt-8">
          <h4 className="mb-2 text-sm font-semibold tracking-tight text-foreground">Porter 5 Forces</h4>
          <p className="text-xs text-muted-foreground">
            점수는 AI 추정(1~5)과 기회 점수 breakdown·경쟁 강도·전략 평가를 합성합니다. 높을수록 해당 힘이 강합니다.
          </p>
          {hasPorterChart && scores ? (
            <>
              <PorterRadar scores={scores} />
              <PorterBars scores={scores} />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">점수를 계산할 시장 지표가 부족합니다.</p>
          )}
          <PorterNarratives porter={porterMerged} />
        </section>

        <section id="report-framework-jtbd" className="scroll-mt-24 border-t border-border/50 pt-8">
          <h4 className="mb-3 text-sm font-semibold tracking-tight text-foreground">JTBD</h4>
          {!hasJtbd ? (
            <p className="text-sm text-muted-foreground">JTBD 데이터가 없습니다.</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">기능적 (Functional)</p>
                <p className="mb-2 text-[11px] text-muted-foreground">업무·효율·성과로 측정되는 핵심 과제</p>
                <BulletList items={jtbdTriad.functional} bulletClass="text-sky-500" />
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">사회적 (Social)</p>
                <p className="mb-2 text-[11px] text-muted-foreground">타인·조직·규범과의 관계에서의 니즈</p>
                <BulletList items={jtbdTriad.social} bulletClass="text-violet-500" />
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/10 p-3">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300">정서적 (Emotional)</p>
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
