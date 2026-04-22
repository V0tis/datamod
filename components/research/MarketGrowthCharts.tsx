'use client'

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { cn } from '@/lib/utils'
import { ChartWithInsight } from './ChartWithInsight'
import { OpportunityChartSourceDialog } from '@/components/analysis/opportunity-chart-source-dialog'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { breakdownToRadarDisplayRows } from '@/lib/chart/opportunity-radar-display'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT } from '@/lib/chart-theme'
import { chartCardClassName, chartFontFamily } from '@/lib/chartTheme'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { BreakdownHorizontalBars } from '@/components/research/BreakdownHorizontalBars'
import { MarketScoreWaterfall } from '@/components/research/MarketScoreWaterfall'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'
import { SearchTrendGrowthChart } from '@/components/research/SearchTrendGrowthChart'

const CHART_GRAY_FILL = '#94a3b8'

function chartInsightNarrative(insight?: string | null, takeaway?: string | null): string {
  return [insight?.trim(), takeaway?.trim()].filter(Boolean).join('\n\n')
}

function normMarketGrowth(v: number): number {
  if (v >= -25 && v <= 25) return v
  return (v - 50) * 0.4
}

function normTrendMomentum(v: number): number {
  if (v >= 0 && v <= 25) return v
  return Math.min(20, Math.max(0, (v / 100) * 20))
}

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

function toMultiAngleRows(
  breakdown: Record<string, number | undefined>,
  opportunityScore: number
): { label: string; value: number; fullMark: number }[] {
  const rows = breakdownToRadarDisplayRows(breakdown)
  if (rows.length >= 4) {
    return rows.map((r) => ({ label: r.subject, value: r.score, fullMark: r.fullMark }))
  }
  const s = Math.min(100, Math.max(0, Math.round(opportunityScore)))
  return [
    { label: '시장 성장', value: Math.round(s * 0.85), fullMark: 100 },
    { label: '트렌드', value: Math.round(s * 0.92), fullMark: 100 },
    { label: '수요 신호', value: Math.round(s * 0.78), fullMark: 100 },
    { label: '경쟁 압력', value: Math.round(Math.max(0, 100 - s) * 0.7), fullMark: 100 },
    { label: '타이밍', value: Math.round(s * 0.8), fullMark: 100 },
  ]
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
  opportunityScoreReasoning?: string | null
  className?: string
  radarSkeleton?: boolean
  /** 섹션 상단 고정: AI PM 한 줄 (대시보드용) */
  pmSectionCaption?: string | null
}

export function MarketGrowthCharts({
  opportunityScore,
  breakdown = {},
  growthSignalsCount = 0,
  marketTemperatureScore,
  chartInsights,
  opportunityScoreReasoning,
  className,
  radarSkeleton = false,
  pmSectionCaption,
}: MarketGrowthChartsProps) {
  const defaultBreakdown = { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const effectiveBreakdown = breakdown && Object.keys(breakdown).length > 0 ? breakdown : defaultBreakdown
  const marketGrowth = effectiveBreakdown?.market_growth ?? 0
  const trendMomentum = effectiveBreakdown?.trend_momentum ?? 0
  const score = Math.min(100, Math.max(0, opportunityScore ?? 0))

  const searchData = buildSearchTrendData(trendMomentum, marketGrowth, marketTemperatureScore ?? 50)

  const adoptionData = buildAdoptionData(growthSignalsCount, trendMomentum)
  const adoptionRates = adoptionData.map((d) => d.rate)
  const aMin = Math.min(...adoptionRates)
  const aMax = Math.max(...adoptionRates)
  const aSpan = Math.max(6, aMax - aMin)
  const aPad = Math.max(3, aSpan * 0.12)
  const adoptionYLow = Math.max(0, Math.floor(aMin - aPad))
  const adoptionYHigh = Math.min(100, Math.ceil(aMax + aPad))

  const multiRows = toMultiAngleRows(effectiveBreakdown as Record<string, number | undefined>, score)

  const st = chartInsights?.search_trend
  const ms = chartInsights?.market_size
  const ar = chartInsights?.adoption_rate
  const ma = chartInsights?.multi_angle

  return (
    <div className={cn('space-y-4', className)}>
      {radarSkeleton ? (
        <SectionContentSkeleton variant="chart" className="rounded-xl border border-border/40 bg-card/30 p-3" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_2fr] lg:items-stretch">
            <ChartWithInsight
              pmCaption={pmSectionCaption}
              title="검색 트렌드 성장"
              description="시장 성장·트렌드 모멘텀을 반영한 월별 상대 검색 관심도 추정(0~100)."
              logicHint="시장 성장·트렌드 모멘텀을 반영해 월별 상대 검색 관심도 추정치를 구성합니다."
              insight={st?.insight}
              takeaway={st?.takeaway}
              variant="flat"
              className={chartCardClassName}
              headerActions={
                <OpportunityChartSourceDialog
                  title="검색 트렌드 — 데이터 출처"
                  variant="chart_insight"
                  reasoning={chartInsightNarrative(st?.insight, st?.takeaway)}
                />
              }
            >
              <SearchTrendGrowthChart data={searchData} />
              <ChartSourceFooter />
            </ChartWithInsight>

            <ChartWithInsight
              title="시장 규모 · 잠재력 (워터폴)"
              description="기준 50에서 시장·트렌드·보정을 순차 반영한 누적 흐름입니다."
              logicHint="기준 가중치에서 시장·트렌드·보정 항을 순차 반영해 최종 기회 점수에 가깝게 누적합니다."
              insight={ms?.insight}
              takeaway={ms?.takeaway}
              variant="flat"
              className={chartCardClassName}
              headerActions={
                <OpportunityChartSourceDialog
                  title="시장 규모 — 데이터 출처"
                  variant="chart_insight"
                  reasoning={chartInsightNarrative(ms?.insight, ms?.takeaway)}
                />
              }
            >
              <div className="flex min-h-[140px] w-full flex-col justify-center">
                <MarketScoreWaterfall
                  opportunityScore={score}
                  marketGrowth={marketGrowth}
                  trendMomentum={trendMomentum}
                />
              </div>
              <ChartSourceFooter />
            </ChartWithInsight>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
            <ChartWithInsight
              title="요인별 강도"
              description="각 막대는 동일 척도(0~100)로 환산된 상대 강도입니다. 색은 점수 구간별로 구분됩니다."
              logicHint="기회 점수 breakdown의 각 축을 동일 스케일(0~100)로 환산한 뒤 비교합니다."
              insight={ma?.insight ?? '기회 점수를 구성하는 축별 상대 강도를 한 화면에서 비교합니다.'}
              takeaway={ma?.takeaway}
              variant="flat"
              className={chartCardClassName}
              headerActions={
                <OpportunityChartSourceDialog
                  reasoning={
                    [opportunityScoreReasoning?.trim(), chartInsightNarrative(ma?.insight, ma?.takeaway)]
                      .filter(Boolean)
                      .join('\n\n') || undefined
                  }
                  breakdown={effectiveBreakdown as Record<string, number | undefined>}
                  variant="breakdown"
                />
              }
            >
              <BreakdownHorizontalBars
                rows={multiRows}
                valueLabel="점수"
                maxDomain={100}
                heightClass="min-h-[220px] max-h-[400px]"
                showSource
              />
            </ChartWithInsight>

            <ChartWithInsight
              title="시장 도입 추이"
              description="성장 시그널 건수와 트렌드 강도를 반영한 S곡선형 단계별 도입률(%) 추정입니다."
              logicHint="성장 시그널 건수와 트렌드 강도를 반영한 S곡선 형태의 단계별 도입률 추정입니다."
              insight={ar?.insight}
              takeaway={ar?.takeaway}
              variant="flat"
              className={chartCardClassName}
              headerActions={
                <OpportunityChartSourceDialog
                  title="시장 도입 추이 — 데이터 출처"
                  variant="chart_insight"
                  reasoning={chartInsightNarrative(ar?.insight, ar?.takeaway)}
                />
              }
            >
              <div className="h-[220px] w-full min-h-[200px] sm:h-[240px]">
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                  <AreaChart data={adoptionData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} style={{ fontFamily: chartFontFamily }}>
                    <defs>
                      <linearGradient id="market-growth-adoption-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_MINT} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={CHART_MINT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRAY_GRID} />
                    <XAxis dataKey="stage" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} />
                    <YAxis
                      domain={[adoptionYLow, adoptionYHigh]}
                      allowDecimals={false}
                      tick={{ fontSize: 10, fill: CHART_GRAY_AXIS, width: 28 }}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v}%`, '도입률']}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 8,
                        border: '1px solid var(--border)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                      }}
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
              <ChartSourceFooter />
            </ChartWithInsight>
          </div>
        </>
      )}
    </div>
  )
}
