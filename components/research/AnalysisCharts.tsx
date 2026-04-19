'use client'

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartWithInsight } from './ChartWithInsight'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { chartAxisMuted, chartFontFamily, divergingFillFromDelta, formatChartInt } from '@/lib/chartTheme'

export interface BreakdownItem {
  name: string
  value: number
  label: string
  delta: number
  arrow: '↑' | '↓' | '→'
  rightLabel: string
}

function breakdownToData(breakdown: Record<string, number | undefined>): BreakdownItem[] {
  const labels: Record<string, string> = {
    market_growth: '시장 성장',
    trend_momentum: '트렌드 모멘텀',
    competition_density: '경쟁 밀도',
    competition_pressure: '경쟁 압력',
    funding_signals: '투자 신호',
    risk_factors: '리스크 요인',
    user_demand: '수요',
    product_differentiation: '차별화',
    market_timing: '시장 타이밍',
  }
  return Object.entries(breakdown)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => {
      const value = Math.round(v as number)
      const delta = value - 50
      const arrow: BreakdownItem['arrow'] = delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
      const sign = delta > 0 ? '+' : ''
      return {
        name: labels[k] ?? k,
        value,
        label: labels[k] ?? k,
        delta,
        arrow,
        rightLabel: `${formatChartInt(value)} ${arrow} (${sign}${formatChartInt(delta)})`,
      }
    })
    .slice(0, 8)
}

export interface AnalysisChartsProps {
  opportunityScoreBreakdown?: Record<string, number | undefined>
  chartInsights?: { score_distribution?: { insight?: string; takeaway?: string } }
  className?: string
}

function DivergingBreakdownChart({ data }: { data: BreakdownItem[] }) {
  const maxAbsDelta = Math.max(8, ...data.map((d) => Math.abs(d.delta)), 1)
  const pad = Math.ceil(maxAbsDelta * 0.08)
  const lim = Math.min(50, maxAbsDelta + pad)
  const chartStyle = { fontFamily: chartFontFamily } as const

  return (
    <div className="w-full min-h-[220px] max-h-[420px]" style={chartStyle}>
      <ResponsiveContainer width="100%" height="100%" minHeight={220}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 52, left: 4, bottom: 20 }} style={chartStyle}>
          <XAxis
            type="number"
            domain={[-lim, lim]}
            tick={{ fontSize: 10, fill: chartAxisMuted }}
            tickFormatter={(x) => formatChartInt(x + 50)}
          />
          <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11, fill: chartAxisMuted }} />
          <ReferenceLine
            x={0}
            stroke="#4F6EF7"
            strokeWidth={2.5}
            strokeOpacity={0.9}
            label={{ value: '기준 50 (Δ=0)', position: 'top', fill: '#4F6EF7', fontSize: 10, fontWeight: 600 }}
          />
          <Tooltip
            cursor={{ fill: 'rgba(79,110,247,0.07)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as BreakdownItem
              const sign = p.delta >= 0 ? '+' : ''
              return (
                <div
                  className="rounded-lg border border-zinc-200 bg-white/98 px-3 py-2 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
                  style={{ fontFamily: chartFontFamily }}
                >
                  <p className="font-semibold text-foreground">{p.name}</p>
                  <p className="mt-1 tabular-nums text-muted-foreground">
                    점수 <span className="font-semibold text-foreground">{formatChartInt(p.value)}</span> / 100 · 50
                    대비{' '}
                    <span className="font-semibold text-foreground">
                      {sign}
                      {formatChartInt(p.delta)}
                    </span>
                  </p>
                </div>
              )
            }}
          />
          <Bar dataKey="delta" radius={[0, 4, 4, 0]} maxBarSize={24} isAnimationActive animationDuration={800}>
            {data.map((d, i) => (
              <Cell key={`cell-${d.name}-${i}`} fill={divergingFillFromDelta(d.delta, lim)} />
            ))}
            <LabelList
              dataKey="rightLabel"
              position="right"
              style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }}
              className="dark:fill-zinc-200"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function MarketGrowthChart({ breakdown, className }: { breakdown: Record<string, number | undefined>; className?: string }) {
  const data = breakdownToData(breakdown)
  if (data.length === 0) return null
  return (
    <div className={cn('w-full', className)}>
      <DivergingBreakdownChart data={data} />
    </div>
  )
}

const SCORE_DIST_DESCRIPTION =
  '요인별 점수(0~100). 가운데 세로선은 중립(50)이며, 막대는 50 대비 편차(Δ)입니다. 빨강 계열은 상대적 약세, 파랑·녹색은 상대적 강세를 뜻합니다.'

export function AnalysisCharts({ opportunityScoreBreakdown, chartInsights, className }: AnalysisChartsProps) {
  const breakdown =
    opportunityScoreBreakdown && Object.keys(opportunityScoreBreakdown).length > 0
      ? opportunityScoreBreakdown
      : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const data = breakdownToData(breakdown)
  if (data.length === 0) return null

  const sd = chartInsights?.score_distribution

  return (
    <ChartWithInsight
      title="시장 점수 분포 · 0~100 척도 (50 기준 발산)"
      description={SCORE_DIST_DESCRIPTION}
      insight={sd?.insight}
      takeaway={sd?.takeaway}
      className={className}
    >
      <DivergingBreakdownChart data={data} />
    </ChartWithInsight>
  )
}
