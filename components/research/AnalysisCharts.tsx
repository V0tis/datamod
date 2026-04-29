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
import { breakdownValueToRadarDisplay } from '@/lib/chart/opportunity-radar-display'
import { chartAxisMuted, chartFontFamily, formatChartInt, getFactorStrengthBarColor } from '@/lib/chartTheme'

const LABELS: Record<string, string> = {
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

function breakdownToDisplayRows(breakdown: Record<string, number | undefined>): { name: string; v: number }[] {
  const rows: { name: string; v: number }[] = []
  for (const [k, raw] of Object.entries(breakdown)) {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue
    const disp = breakdownValueToRadarDisplay(k, raw)
    if (disp == null) continue
    rows.push({ name: LABELS[k] ?? k, v: disp })
  }
  return rows.slice(0, 8)
}

function ScoreDistributionBars({ data }: { data: { name: string; v: number }[] }) {
  const chartStyle = { fontFamily: chartFontFamily } as const
  const avg = data.length ? data.reduce((s, d) => s + d.v, 0) / data.length : 0

  return (
    <div className="w-full min-h-[220px] max-h-[420px]" style={chartStyle}>
      <ResponsiveContainer width="100%" height="100%" minHeight={220}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 42, right: 48, left: 4, bottom: 8 }}
          style={chartStyle}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: chartAxisMuted }}
            tickLine={false}
            axisLine={{ stroke: 'rgba(148,163,184,0.4)' }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={118}
            tick={{ fontSize: 11, fill: chartAxisMuted }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <ReferenceLine
            x={avg}
            stroke="#64748B"
            strokeDasharray="4 4"
            strokeWidth={1.25}
            label={{
              value: `평균 ${formatChartInt(Math.round(avg))}`,
              position: 'top',
              fill: '#64748B',
              fontSize: 11,
              fontWeight: 600,
            }}
          />
          <Tooltip
            formatter={(v: number) => [`${formatChartInt(v)} / 100`, '환산 점수']}
            contentStyle={{
              fontFamily: chartFontFamily,
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
            }}
          />
          <Bar dataKey="v" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive animationDuration={800}>
            {data.map((d, i) => (
              <Cell key={`score-${d.name}-${i}`} fill={getFactorStrengthBarColor(d.v)} />
            ))}
            <LabelList
              dataKey="v"
              position="right"
              formatter={(v: number) => formatChartInt(v)}
              style={{ fill: '#374151', fontSize: 12, fontWeight: 600 }}
              className=""
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500 ">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#0D9F6E]" aria-hidden />
          70+ 강한 긍정
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#34D399]" aria-hidden />
          55~69
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#93C5FD]" aria-hidden />
          45~54
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#FCD34D]" aria-hidden />
          30~44
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#F87171]" aria-hidden />
          30 미만
        </span>
      </div>
    </div>
  )
}

export function MarketGrowthChart({ breakdown, className }: { breakdown: Record<string, number | undefined>; className?: string }) {
  const data = breakdownToDisplayRows(breakdown)
  if (data.length === 0) return null
  return (
    <div className={cn('w-full', className)}>
      <ScoreDistributionBars data={data} />
    </div>
  )
}

const SCORE_DIST_DESCRIPTION =
  '원시 breakdown을 동일 척도(0~100)로 환산한 실제 점수입니다. 막대 색은 절대 수준에 따라 결정됩니다.'

export interface AnalysisChartsProps {
  opportunityScoreBreakdown?: Record<string, number | undefined>
  chartInsights?: { score_distribution?: { insight?: string; takeaway?: string } }
  className?: string
}

export function AnalysisCharts({ opportunityScoreBreakdown, chartInsights, className }: AnalysisChartsProps) {
  const breakdown =
    opportunityScoreBreakdown && Object.keys(opportunityScoreBreakdown).length > 0
      ? opportunityScoreBreakdown
      : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const data = breakdownToDisplayRows(breakdown as Record<string, number | undefined>)
  if (data.length === 0) return null

  const sd = chartInsights?.score_distribution

  return (
    <ChartWithInsight
      title="시장 요인별 점수 (0~100)"
      description={SCORE_DIST_DESCRIPTION}
      insight={sd?.insight}
      takeaway={sd?.takeaway}
      className={className}
    >
      <ScoreDistributionBars data={data} />
    </ChartWithInsight>
  )
}
