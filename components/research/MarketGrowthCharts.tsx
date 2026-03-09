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
  className,
}: MarketGrowthChartsProps) {
  /** 분석 중에도 차트 표시: 값 없으면 default 사용 */
  const defaultBreakdown = { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const effectiveBreakdown = breakdown && Object.keys(breakdown).length > 0 ? breakdown : defaultBreakdown
  const marketGrowth = effectiveBreakdown?.market_growth ?? 50
  const trendMomentum = effectiveBreakdown?.trend_momentum ?? 50
  const score = opportunityScore ?? 50

  const searchData = buildSearchTrendData(trendMomentum, marketGrowth, marketTemperatureScore ?? 50)
  const sizeData = buildMarketSizeData(score)
  const adoptionData = buildAdoptionData(growthSignalsCount, trendMomentum)

  return (
    <div className={cn('grid grid-cols-1 lg:grid-cols-3 gap-4', className)}>
      {/* 1. Search trend growth line chart */}
      <div className="rounded-xl border border-border/60 bg-muted/5 p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          검색 트렌드 성장
        </h4>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={searchData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                formatter={(v: number) => [`${v}`, '검색 관심도']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
      </div>

      {/* 2. Market size projection chart */}
      <div className="rounded-xl border border-border/60 bg-muted/5 p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          시장 규모 전망
        </h4>
        <div className="h-[160px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sizeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 120]} tick={{ fontSize: 10 }} width={28} />
              <Tooltip
                formatter={(v: number) => [`${v}/100`, '시장 매력도']}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="size" fill={CHART_EMERALD} radius={[4, 4, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. Adoption rate trend */}
      <div className="rounded-xl border border-border/60 bg-muted/5 p-4">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          시장 도입 추이
        </h4>
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
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
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
      </div>
    </div>
  )
}
