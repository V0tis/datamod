'use client'

import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartWithInsight } from './ChartWithInsight'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'

const CHART_PRIMARY = '#6366f1'
const CHART_EMERALD = '#10b981'
const CHART_BLUE = '#3b82f6'

/** Normalize market_growth to -20..+20 scale (handles both formula and legacy 0-100) */
function normMarketGrowth(v: number): number {
  if (v >= -25 && v <= 25) return v
  return (v - 50) * 0.4
}

/** Normalize trend_momentum to 0..20 scale */
function normTrendMomentum(v: number): number {
  if (v >= 0 && v <= 25) return v
  return Math.min(20, Math.max(0, (v / 100) * 20))
}

/** Generate 6-month search trend line from momentum + market growth */
function buildSearchTrendData(
  trendMomentum: number,
  marketGrowth: number,
  base = 50
): { month: string; value: number }[] {
  const mg = normMarketGrowth(marketGrowth)
  const tm = normTrendMomentum(trendMomentum)
  const slope = mg * 0.4 + (tm - 10) * 0.5
  const months = ['6개월 전', '5개월 전', '4개월 전', '3개월 전', '2개월 전', '현재']
  return months.map((month, i) => {
    const progress = i / (months.length - 1)
    const value = Math.round(Math.min(100, Math.max(0, base + slope * progress * 5)))
    return { month, value }
  })
}

/** Current vs 1Y projection from opportunity score */
function buildMarketSizeData(opportunityScore: number): { period: string; size: number }[] {
  const growthFactor = 1 + (opportunityScore - 50) / 100
  const projected = Math.round(Math.min(150, Math.max(50, opportunityScore * growthFactor)))
  return [
    { period: '현재', size: opportunityScore },
    { period: '1년 후', size: projected },
  ]
}

/** Adoption curve (S-curve style) from growth signals + momentum */
function buildAdoptionData(
  growthSignalsCount: number,
  trendMomentum: number
): { stage: string; rate: number }[] {
  const tm = normTrendMomentum(trendMomentum)
  const strength = Math.min(100, growthSignalsCount * 15 + tm * 3)
  const stages = ['초기', '성장', '가속', '성숙']
  return stages.map((stage, i) => {
    const x = i / (stages.length - 1)
    const sCurve = 1 / (1 + Math.exp(-6 * (x - 0.5)))
    const rate = Math.round(Math.min(100, Math.max(8, strength * sCurve * (0.7 + 0.3 * x))))
    return { stage, rate }
  })
}

export interface ChartInsights {
  search_trend?: { insight?: string; takeaway?: string }
  market_size?: { insight?: string; takeaway?: string }
  adoption_rate?: { insight?: string; takeaway?: string }
  score_distribution?: { insight?: string; takeaway?: string }
}

export interface MarketGrowthChartsProps {
  opportunityScore?: number | null
  breakdown?: {
    market_growth?: number
    trend_momentum?: number
    [key: string]: number | undefined
  } | null
  growthSignalsCount?: number
  marketTemperatureScore?: number | null
  keyword?: string
  chartInsights?: ChartInsights
  className?: string
}

/**
 * Visual charts for Market Growth Analysis: Search trend, Market size projection, Adoption rate.
 * Replaces long text with scannable visuals.
 */
export function MarketGrowthCharts({
  opportunityScore,
  breakdown = {},
  growthSignalsCount = 0,
  marketTemperatureScore,
  chartInsights,
  className,
}: MarketGrowthChartsProps) {
  /** 분석 중에도 차트 표시: 값 없으면 default 사용 */
  const defaultBreakdown = { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const effectiveBreakdown = breakdown && Object.keys(breakdown).length > 0 ? breakdown : defaultBreakdown
  const marketGrowth = effectiveBreakdown?.market_growth ?? 0
  const trendMomentum = effectiveBreakdown?.trend_momentum ?? 0
  const score = opportunityScore ?? 0

  const searchData = buildSearchTrendData(trendMomentum, marketGrowth, marketTemperatureScore ?? 0)
  const sizeData = buildMarketSizeData(score)
  const adoptionData = buildAdoptionData(growthSignalsCount, trendMomentum)

  const st = chartInsights?.search_trend
  const ms = chartInsights?.market_size
  const ar = chartInsights?.adoption_rate

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-4', className)}>
      {/* 1. Search trend growth line chart */}
      <ChartWithInsight
        title="검색 트렌드 성장"
        insight={st?.insight}
        takeaway={st?.takeaway}
      >
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={searchData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                formatter={(v: number) => [`${v}`, '검색 관심도']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                cursor={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={CHART_BLUE}
                strokeWidth={2}
                dot={{ fill: CHART_BLUE, r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartWithInsight>

      {/* 2. Market size projection chart */}
      <ChartWithInsight
        title="시장 규모 전망"
        insight={ms?.insight}
        takeaway={ms?.takeaway}
      >
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sizeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 120]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                formatter={(v: number) => [`${v}/100`, '시장 매력도']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                cursor={false}
              />
              <Bar dataKey="size" fill={CHART_EMERALD} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartWithInsight>

      {/* 3. Adoption rate trend */}
      <ChartWithInsight
        title="시장 도입 추이"
        insight={ar?.insight}
        takeaway={ar?.takeaway}
      >
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={adoptionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="market-growth-adoption-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_PRIMARY} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="stage" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                formatter={(v: number) => [`${v}%`, '도입률']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                cursor={false}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke={CHART_PRIMARY}
                strokeWidth={2}
                fill="url(#market-growth-adoption-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartWithInsight>
    </div>
  )
}
