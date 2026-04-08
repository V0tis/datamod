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
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartWithInsight } from './ChartWithInsight'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT, CHART_MINT_SOFT } from '@/lib/chart-theme'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'

const CHART_GRAY_FILL = '#94a3b8'

const RADAR_LABELS: Record<string, string> = {
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

function breakdownToRadarRows(breakdown: Record<string, number | undefined>): { subject: string; score: number; fullMark: number }[] {
  return Object.entries(breakdown)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => ({
      subject: RADAR_LABELS[k] ?? k,
      score: Math.min(100, Math.max(0, v as number)),
      fullMark: 100,
    }))
    .slice(0, 8)
}

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
  multi_angle?: { insight?: string; takeaway?: string }
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
  /** 기회 점수·트렌드가 아직 없을 때 방사형 차트 영역만 스켈레톤 */
  radarSkeleton?: boolean
}

/**
 * 시장 성장: 방사형(다각도) + 트렌드 라인 · 규모 바 · 도입 영역 (민트·그레이 톤).
 */
export function MarketGrowthCharts({
  opportunityScore,
  breakdown = {},
  growthSignalsCount = 0,
  marketTemperatureScore,
  chartInsights,
  className,
  radarSkeleton = false,
}: MarketGrowthChartsProps) {
  const defaultBreakdown = { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const effectiveBreakdown = breakdown && Object.keys(breakdown).length > 0 ? breakdown : defaultBreakdown
  const marketGrowth = effectiveBreakdown?.market_growth ?? 0
  const trendMomentum = effectiveBreakdown?.trend_momentum ?? 0
  const score = Math.min(100, Math.max(0, opportunityScore ?? 0))

  const searchData = buildSearchTrendData(trendMomentum, marketGrowth, marketTemperatureScore ?? 50)
  const sizeData = buildMarketSizeData(score)
  const adoptionData = buildAdoptionData(growthSignalsCount, trendMomentum)

  let radarRows = breakdownToRadarRows(effectiveBreakdown as Record<string, number | undefined>)
  if (radarRows.length < 4) {
    radarRows = [
      { subject: '시장 성장', score: Math.round(score * 0.85), fullMark: 100 },
      { subject: '트렌드', score: Math.round(score * 0.92), fullMark: 100 },
      { subject: '수요 신호', score: Math.round(score * 0.78), fullMark: 100 },
      { subject: '경쟁 압력', score: Math.round(Math.max(0, 100 - score) * 0.7), fullMark: 100 },
      { subject: '타이밍', score: Math.round(score * 0.8), fullMark: 100 },
    ]
  }

  const st = chartInsights?.search_trend
  const ms = chartInsights?.market_size
  const ar = chartInsights?.adoption_rate
  const ma = chartInsights?.multi_angle

  return (
    <div className={cn('space-y-4', className)}>
      {radarSkeleton ? (
        <SectionContentSkeleton variant="chart" className="rounded-xl border border-border/40 bg-card/30 p-3" />
      ) : (
        <ChartWithInsight
          title="시장 다각도 분석 (레이더)"
          insight={ma?.insight ?? '기회 점수를 구성하는 축별 상대 강도를 한 화면에서 비교합니다.'}
          takeaway={ma?.takeaway}
          className="border border-border/60 bg-card/50"
        >
          <div className="aspect-square w-full min-h-[220px] max-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="72%" data={radarRows}>
                <PolarGrid stroke={CHART_GRAY_GRID} />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} />
                <PolarRadiusAxis angle={45} domain={[0, 100]} tick={{ fontSize: 9, fill: CHART_GRAY_AXIS }} />
                <Tooltip
                  formatter={(v: number) => [`${v}/100`, '점수']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
                />
                <Radar
                  name="지표"
                  dataKey="score"
                  stroke={CHART_MINT}
                  fill={CHART_MINT_SOFT}
                  fillOpacity={0.45}
                  strokeWidth={2}
                  dot={{ r: 3, fill: CHART_MINT }}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartWithInsight>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 md:gap-5">
        <ChartWithInsight title="검색 트렌드 성장" insight={st?.insight} takeaway={st?.takeaway}>
          <div className="aspect-video w-full min-h-[160px] max-h-[280px] sm:min-h-[180px] sm:max-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={searchData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRAY_GRID} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: CHART_GRAY_AXIS, width: 28 }} />
                <Tooltip
                  formatter={(v: number) => [`${v}`, '검색 관심도']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  cursor={false}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={CHART_MINT}
                  strokeWidth={2}
                  dot={{ fill: CHART_MINT, r: 3 }}
                  activeDot={{ r: 5, fill: CHART_MINT }}
                  isAnimationActive
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartWithInsight>

        <ChartWithInsight title="시장 규모 전망" insight={ms?.insight} takeaway={ms?.takeaway}>
          <div className="aspect-video w-full min-h-[160px] max-h-[280px] sm:min-h-[180px] sm:max-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sizeData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRAY_GRID} vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} />
                <YAxis domain={[0, 120]} tick={{ fontSize: 10, fill: CHART_GRAY_AXIS, width: 28 }} />
                <Tooltip
                  formatter={(v: number) => [`${v}/100`, '시장 매력도']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  cursor={false}
                />
                <Bar
                  dataKey="size"
                  fill={CHART_MINT}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                  isAnimationActive
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartWithInsight>

        <ChartWithInsight title="시장 도입 추이" insight={ar?.insight} takeaway={ar?.takeaway}>
          <div className="aspect-video w-full min-h-[160px] max-h-[280px] sm:min-h-[180px] sm:max-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={adoptionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="market-growth-adoption-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_MINT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART_MINT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRAY_GRID} />
                <XAxis dataKey="stage" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: CHART_GRAY_AXIS, width: 28 }} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, '도입률']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                  cursor={false}
                />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke={CHART_GRAY_FILL}
                  strokeWidth={1.5}
                  fill="url(#market-growth-adoption-grad)"
                  isAnimationActive
                  animationDuration={1000}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartWithInsight>
      </div>
    </div>
  )
}
