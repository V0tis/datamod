'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lightbulb } from 'lucide-react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { formatDistanceToNow, isValid, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { SectionHeader } from '@/components/analysis/shared/SectionHeader'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import { buildStructuredInsightsList } from '@/lib/build-structured-insights-list'
import type { StructuredInsight } from '@/components/research/StructuredInsightCard'
import { cn } from '@/lib/utils'
import {
  enrichPorter5Forces,
  resolveJtbdTriad,
  type Porter5ForcesShape,
  type PorterFiveScores,
} from '@/lib/strategy-framework-mapper'
import { porterFiveScoreTo10 } from '@/lib/score-display'
import type { ResearchResponse } from '@/lib/stores/research-store'

const INSIGHT_TABS = ['핵심 인사이트', 'SWOT', '포터 5요인', '고객 과제'] as const
export type InsightStrategyTabId = (typeof INSIGHT_TABS)[number]

type TaskOutput = Record<string, unknown>
type AnalysisTask = {
  step_name: string
  status: string
  output_data: unknown
}

function getTaskOutput(
  step: string,
  taskData: Partial<Record<string, unknown>>,
  analysisTasks: AnalysisTask[] | null | undefined
): TaskOutput | null {
  const task = analysisTasks?.find((t) => t.step_name === step)
  const raw = (task?.output_data && typeof task.output_data === 'object'
    ? task.output_data
    : taskData[step]) as TaskOutput | null
  return raw && typeof raw === 'object' ? raw : null
}

function getPorterColor(v: number): string {
  if (v >= 8) return 'var(--color-destructive)'
  if (v >= 6) return 'var(--color-warning)'
  return 'var(--color-success)'
}

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

function formatDataAge(iso?: string): string {
  if (!iso?.trim()) return ''
  const d = parseISO(iso.trim())
  if (!isValid(d)) return ''
  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: ko })
  } catch {
    return ''
  }
}

function priorityToUi(p?: StructuredInsight['priority']): {
  label: '높음' | '중간' | '낮음'
  borderLeft: string
  bg: string
  border: string
  badgeColor: string
} {
  if (p === 'high') {
    return {
      label: '높음',
      borderLeft: 'var(--color-destructive)',
      bg: 'color-mix(in srgb, var(--color-destructive) 10%, var(--color-background))',
      border: 'color-mix(in srgb, var(--color-destructive) 28%, var(--color-border))',
      badgeColor: 'var(--color-destructive)',
    }
  }
  if (p === 'mid') {
    return {
      label: '중간',
      borderLeft: 'var(--color-warning)',
      bg: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-background))',
      border: 'color-mix(in srgb, var(--color-warning) 30%, var(--color-border))',
      badgeColor: 'var(--color-warning)',
    }
  }
  return {
    label: '낮음',
    borderLeft: 'var(--color-success)',
    bg: 'color-mix(in srgb, var(--color-success) 10%, var(--color-background))',
    border: 'color-mix(in srgb, var(--color-success) 25%, var(--color-border))',
    badgeColor: 'var(--color-success)',
  }
}

function insightBodyText(insight: StructuredInsight): string {
  const parts = [insight.summary]
  if (insight.impact?.trim()) parts.push(insight.impact.trim())
  if (insight.reason?.trim()) parts.push(insight.reason.trim())
  return parts.filter(Boolean).join('\n\n')
}

function InsightCardsGrid({ insights }: { insights: StructuredInsight[] }) {
  if (insights.length === 0) {
    return <p className="text-sm text-muted-foreground">표시할 핵심 인사이트가 없습니다.</p>
  }
  return (
    <div className="columns-1 [column-gap:1rem] sm:columns-2">
      {insights.map((insight, i) => {
        const ui = priorityToUi(insight.priority)
        const dataAge = formatDataAge(insight.sourceTimestamp)
        const evidence = insight.keyMetrics ?? []
        return (
          <div
            key={`${insight.title}-${i}`}
            className="mb-4 break-inside-avoid rounded-xl border border-l-[3px] p-4 transition-shadow hover:shadow-sm"
            style={{
              background: ui.bg,
              borderColor: ui.border,
              borderLeftColor: ui.borderLeft,
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="text-[10px] font-bold tracking-wide" style={{ color: ui.badgeColor }}>
                우선순위 · {ui.label}
              </span>
              {dataAge ? <span className="text-[10px] text-[var(--color-muted-foreground)]">{dataAge}</span> : null}
            </div>
            <h4 className="mb-2 text-sm font-semibold leading-snug text-[var(--color-foreground)]">{insight.title}</h4>
            <p className="text-[13px] leading-relaxed text-[var(--color-muted-foreground)]">{insightBodyText(insight)}</p>
            {evidence.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {evidence.map((e) => (
                  <span
                    key={e}
                    className="rounded border border-[var(--color-border)] bg-[var(--color-card)]/80 px-2 py-0.5 text-[11px] text-[var(--color-muted-foreground)]"
                  >
                    {e}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

type SwotShape = NonNullable<ResearchResponse['key_metrics']>['swot_analysis']

function SwotQuadrantMatrix({ swot }: { swot: NonNullable<SwotShape> }) {
  const quadrants = [
    {
      key: 'strengths',
      label: '강점 S',
      color: 'var(--color-success)',
      bg: 'color-mix(in srgb, var(--color-success) 12%, var(--color-background))',
      items: swot.strengths ?? [],
    },
    {
      key: 'weaknesses',
      label: '약점 W',
      color: 'var(--color-destructive)',
      bg: 'color-mix(in srgb, var(--color-destructive) 10%, var(--color-background))',
      items: swot.weaknesses ?? [],
    },
    {
      key: 'opportunities',
      label: '기회 O',
      color: 'var(--color-chart-3)',
      bg: 'color-mix(in srgb, var(--color-chart-3) 12%, var(--color-background))',
      items: swot.opportunities ?? [],
    },
    {
      key: 'threats',
      label: '위협 T',
      color: 'var(--color-warning)',
      bg: 'color-mix(in srgb, var(--color-warning) 12%, var(--color-background))',
      items: swot.threats ?? [],
    },
  ] as const

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden rounded-xl">
      {quadrants.map((q) => (
        <div key={q.key} className="min-h-[140px] p-5" style={{ background: q.bg }}>
          <div className="mb-3 flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold"
              style={{
                background: q.color,
                color:
                  q.key === 'strengths'
                    ? 'var(--color-success-foreground)'
                    : q.key === 'weaknesses'
                      ? 'var(--color-destructive-foreground)'
                      : q.key === 'opportunities'
                        ? 'var(--color-primary-foreground)'
                        : 'var(--color-warning-foreground)',
              }}
            >
              {q.label.slice(-1)}
            </div>
            <span className="text-sm font-bold" style={{ color: q.color }}>
              {q.label}
            </span>
          </div>
          {q.items.length === 0 ? (
            <p className="text-[13px] text-[var(--color-muted-foreground)]">해당 항목 없음</p>
          ) : (
            <ul className="space-y-1.5">
              {q.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--color-foreground)]">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full" style={{ background: q.color }} />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function JtbdGrid({
  functional,
  social,
  emotional,
}: {
  functional: string[]
  social: string[]
  emotional: string[]
}) {
  const cols = [
    {
      title: '기능적 과제',
      sub: '업무·효율·성과로 측정되는 핵심 과제',
      items: functional,
      bullet: 'text-[var(--color-chart-3)]',
      titleClass: 'text-[var(--color-chart-3)]',
    },
    {
      title: '사회적 니즈',
      sub: '타인·조직·규범과의 관계에서의 니즈',
      items: social,
      bullet: 'text-[var(--color-chart-4)]',
      titleClass: 'text-[var(--color-chart-4)]',
    },
    {
      title: '정서적 동기',
      sub: '불안 완화·자신감·만족 등 정서 동기',
      items: emotional,
      bullet: 'text-[var(--color-chart-2)]',
      titleClass: 'text-[var(--color-chart-2)]',
    },
  ] as const
  const empty = cols.every((c) => c.items.length === 0)
  if (empty) {
    return <p className="text-sm text-muted-foreground">고객 과제 데이터가 없습니다.</p>
  }
  return (
    <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
      {cols.map((col) => (
        <div
          key={col.title}
          className="border-b border-border/50 pb-6 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-6 last:border-r-0 last:pr-0 last:sm:border-r-0"
        >
          <p className={cn('mb-1.5 text-[11px] font-bold uppercase tracking-wide', col.titleClass)}>{col.title}</p>
          <p className="mb-2 text-[11px] text-muted-foreground">{col.sub}</p>
          {col.items.length === 0 ? (
            <p className="text-xs text-muted-foreground">해당 항목 없음</p>
          ) : (
            <ul className="list-none space-y-1.5 pl-0 text-sm">
              {col.items.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={cn('shrink-0', col.bullet)}>•</span>
                  <span className="leading-relaxed text-foreground">{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}

function porterPressureSummary(avg: number): string {
  if (avg >= 8) return '매우 높음'
  if (avg >= 6) return '높음'
  if (avg >= 4) return '보통'
  return '낮음'
}

function PorterForcesVisual({
  scores,
  porter,
}: {
  scores: PorterFiveScores
  porter: Porter5ForcesShape
}) {
  const rows: { key: PorterNarrativeKey; label: string; v5: number; v10: number }[] = [
    { key: 'new_entrants', label: '진입 위협', v5: clampPorterInt(scores.new_entrants), v10: porterFiveScoreTo10(clampPorterInt(scores.new_entrants)) },
    { key: 'supplier_power', label: '공급자', v5: clampPorterInt(scores.supplier_power), v10: porterFiveScoreTo10(clampPorterInt(scores.supplier_power)) },
    { key: 'buyer_power', label: '구매자', v5: clampPorterInt(scores.buyer_power), v10: porterFiveScoreTo10(clampPorterInt(scores.buyer_power)) },
    { key: 'substitutes', label: '대체재', v5: clampPorterInt(scores.substitutes), v10: porterFiveScoreTo10(clampPorterInt(scores.substitutes)) },
    { key: 'rivalry', label: '경쟁', v5: clampPorterInt(scores.rivalry), v10: porterFiveScoreTo10(clampPorterInt(scores.rivalry)) },
  ]

  const avg = rows.reduce((s, r) => s + r.v10, 0) / rows.length
  const avgRounded = Math.round(avg * 10) / 10
  const radarData = rows.map((r) => ({ subject: r.label, score: r.v10, fullMark: 10 }))

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/60 bg-muted/5 px-4 py-3 text-sm">
        <span className="font-semibold text-foreground">종합 경쟁 압력: </span>
        <span className="tabular-nums text-foreground">{avgRounded}/10</span>
        <span className="text-muted-foreground"> — {porterPressureSummary(avgRounded)}</span>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          다섯 가지 힘의 /10 환산 평균입니다. 높을수록 산업 내 경쟁·교섭 압력이 큽니다.
        </p>
      </div>

      <div className="h-56 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke="var(--color-border)" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
            <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fontSize: 9 }} />
            <Radar
              name="압력"
              dataKey="score"
              stroke="var(--color-primary)"
              fill="var(--color-primary)"
              fillOpacity={0.28}
              dot={{ r: 3 }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full min-w-0 space-y-3.5" role="img" aria-label="포터 요인 가로 막대">
        {rows.map((row) => {
          const pct = Math.min(100, Math.max(0, (row.v10 / 10) * 100))
          const fill = getPorterColor(row.v10)
          const reason = porterReasonLine(porter, row.key, row.v5)
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
                  <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, backgroundColor: fill }} />
                </div>
                <span className="w-10 shrink-0 tabular-nums text-right text-[11px] font-medium text-foreground">
                  {row.v10}/10
                </span>
              </div>
              <p className="min-w-0 flex-[1.2] text-xs leading-relaxed text-[var(--color-muted-foreground)] sm:pt-0.5">{reason}</p>
            </div>
          )
        })}
      </div>
      <ChartSourceFooter />
    </div>
  )
}

export type InsightStrategyTabsPanelProps = {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: AnalysisTask[] | null
  consensusData?: {
    strategicSummary?: { opportunity?: string; summary?: string }
  } | null
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  loading?: boolean
  className?: string
}

export function InsightStrategyTabsPanel({
  result,
  taskData = {},
  analysisTasks = null,
  consensusData,
  newsList = [],
  loading = false,
  className,
}: InsightStrategyTabsPanelProps) {
  const [insightTab, setInsightTab] = useState<InsightStrategyTabId>(INSIGHT_TABS[0])

  const insights = useMemo(
    () =>
      buildStructuredInsightsList({
        result,
        taskData,
        analysisTasks,
        consensusData,
        newsList,
      }),
    [result, taskData, analysisTasks, consensusData, newsList]
  )

  const km = result?.key_metrics ?? {}
  const executionOutput = getTaskOutput('execution_layer', taskData, analysisTasks)
  const breakdown = km.opportunity_score_breakdown ?? {}

  const swot = km.swot_analysis ?? (executionOutput?.swot_analysis as typeof km.swot_analysis)
  const jtbd = km.jtbd ?? (executionOutput?.jtbd as typeof km.jtbd)
  const porterRaw = km.porter_5_forces ?? (executionOutput?.porter_5_forces as typeof km.porter_5_forces)

  const porterMerged = useMemo(
    () =>
      enrichPorter5Forces(
        porterRaw ?? undefined,
        breakdown,
        km.strategic_decision_layer ?? undefined,
        km.strategy_evaluation ?? undefined
      ),
    [porterRaw, breakdown, km.strategic_decision_layer, km.strategy_evaluation]
  )

  const scores = porterMerged.scores as PorterFiveScores | undefined
  const hasPorterChart = scores != null && Object.values(scores).every((n) => typeof n === 'number')

  const jtbdTriad = useMemo(() => resolveJtbdTriad(jtbd ?? undefined), [jtbd])

  const hasSwot =
    !!swot &&
    !!(swot.strengths?.length || swot.weaknesses?.length || swot.opportunities?.length || swot.threats?.length)

  const showSkeleton = loading && insights.length === 0 && !hasSwot && !hasPorterChart

  return (
    <div className={cn('rin-card font-sans overflow-hidden', className)}>
      <div className="px-6 pt-6">
        <SectionHeader icon={Lightbulb} title="인사이트 · 전략" badge="전략" badgeVariant="blue" status={loading ? 'generating' : 'done'} />
      </div>

      <div className="-mx-6 mb-6 flex gap-1 border-b border-[var(--color-border)] px-6">
        {INSIGHT_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setInsightTab(tab)}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-all',
              insightTab === tab
                ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="px-6 pb-6">
        {showSkeleton ? (
          <div className="space-y-3 animate-pulse" aria-busy="true">
            <div className="h-24 rounded-xl bg-muted/50" />
            <div className="h-24 rounded-xl bg-muted/40" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {insightTab === '핵심 인사이트' && (
              <motion.div
                key="ins"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <InsightCardsGrid insights={insights} />
              </motion.div>
            )}
            {insightTab === 'SWOT' && (
              <motion.div
                key="swot"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {hasSwot && swot ? (
                  <SwotQuadrantMatrix swot={swot} />
                ) : (
                  <p className="text-sm text-muted-foreground">SWOT 데이터가 없습니다.</p>
                )}
              </motion.div>
            )}
            {insightTab === '포터 5요인' && (
              <motion.div
                key="porter"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {hasPorterChart && scores ? (
                  <PorterForcesVisual scores={scores} porter={porterMerged} />
                ) : (
                  <p className="text-sm text-muted-foreground">포터 분석 점수를 계산할 시장 지표가 부족합니다.</p>
                )}
              </motion.div>
            )}
            {insightTab === '고객 과제' && (
              <motion.div
                key="jtbd"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <JtbdGrid functional={jtbdTriad.functional} social={jtbdTriad.social} emotional={jtbdTriad.emotional} />
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
