'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { ChartData } from '@/lib/stores/research-store'

const SENTIMENT_LABELS = {
  positive: '긍정적 신호',
  neutral: '중립 유지',
  negative: '부정적 리스크',
} as const
/** 다크 모드에서 선명한 색상 */
const SENTIMENT_COLORS = {
  positive: '#34d399',
  neutral: '#94a3b8',
  negative: '#fb7185',
} as const

const STROKE_WIDTH = 3
const FILL_OPACITY = 0.1
const X_TICK_HOURS = [0, 6, 12, 18, 24] as const

/** hour(0~24) → "HH:00" 표시 (당일 기준) */
function formatHourLabel(hour: number): string {
  const h = Math.max(0, Math.min(24, Math.round(hour)))
  if (h === 24) return '24:00'
  return `${String(h).padStart(2, '0')}:00`
}

interface ResearchChartsProps {
  chartData: ChartData
  consensusScore?: number | null
  trend?: 'rising' | 'falling' | 'stable'
  onLastPointScore?: (score: number) => void
  /** 전일 대비 변동폭(%): (last - first) / |first| * 100. 차트에서 계산해 전달 */
  onVariance?: (variancePct: number) => void
  /** 툴팁에 표시할 주요 뉴스/키워드 (PM이 수치 변화 맥락 파악용) */
  marketNews?: string[]
}

function isValidSentiment(s: unknown): s is { positive: number; neutral: number; negative: number } {
  if (!s || typeof s !== 'object') return false
  const o = s as Record<string, unknown>
  const p = Number(o.positive)
  const n = Number(o.neutral)
  const neg = Number(o.negative)
  return (
    Number.isFinite(p) && p >= 0 &&
    Number.isFinite(n) && n >= 0 &&
    Number.isFinite(neg) && neg >= 0 &&
    (p + n + neg) > 0
  )
}

/** 0~24시 시계열: 마지막(24h)=현재 비율, trend로 흐름 생성 */
function buildTimeSeriesData(
  positivePct: number,
  neutralPct: number,
  negativePct: number,
  trend: 'rising' | 'falling' | 'stable'
): Array<{ hour: number; positive: number; neutral: number; negative: number }> {
  const points = 25
  const delta = 5
  const startPos = Math.max(0, Math.min(100, positivePct - (trend === 'rising' ? delta : trend === 'falling' ? -delta : 0)))
  const startNeg = Math.max(0, Math.min(100, negativePct + (trend === 'rising' ? delta : trend === 'falling' ? -delta : 0)))
  return Array.from({ length: points }, (_, i) => {
    const t = i / (points - 1)
    const isLast = i === points - 1
    const positive = isLast ? positivePct : Math.round(startPos + t * (positivePct - startPos))
    const neutral = isLast ? neutralPct : Math.round(neutralPct + (t - 0.5) * 4)
    const negative = isLast ? negativePct : Math.round(startNeg + t * (negativePct - startNeg))
    return {
      hour: i,
      positive: Math.max(0, Math.min(100, positive)),
      neutral: Math.max(0, Math.min(100, neutral)),
      negative: Math.max(0, Math.min(100, negative)),
    }
  })
}

function ChartSkeleton() {
  return (
    <div className="min-h-[240px] w-full rounded-lg bg-slate-800/50 border border-slate-700/50 flex flex-col justify-center items-center gap-3 p-6 animate-pulse">
      <div className="h-3 w-32 bg-slate-600/50 rounded" />
      <div className="h-2 w-48 bg-slate-600/30 rounded" />
      <div className="flex gap-2 mt-2">
        <div className="w-16 h-16 rounded-full bg-slate-600/30" />
        <div className="w-20 h-20 rounded bg-slate-600/20" />
        <div className="w-16 h-16 rounded-full bg-slate-600/30" />
      </div>
    </div>
  )
}

export function ResearchCharts({
  chartData,
  trend = 'stable',
  onLastPointScore,
  onVariance,
  marketNews = [],
}: ResearchChartsProps) {
  const [visible, setVisible] = useState({ positive: true, neutral: true, negative: true })

  const sentiment = chartData?.sentiment
  const valid = isValidSentiment(sentiment)
  const totalSentiment = valid
    ? (sentiment.positive + sentiment.neutral + sentiment.negative)
    : 0
  const percentages = valid && totalSentiment > 0
    ? {
        positive: Math.round((sentiment.positive / totalSentiment) * 100),
        neutral: Math.round((sentiment.neutral / totalSentiment) * 100),
        negative: Math.round((sentiment.negative / totalSentiment) * 100),
      }
    : { positive: 0, neutral: 0, negative: 0 }

  const timeSeriesData = useMemo(
    () =>
      valid
        ? buildTimeSeriesData(percentages.positive, percentages.neutral, percentages.negative, trend)
        : [],
    [valid, percentages.positive, percentages.neutral, percentages.negative, trend]
  )

  useEffect(() => {
    if (timeSeriesData.length > 0) {
      const first = timeSeriesData[0]
      const last = timeSeriesData[timeSeriesData.length - 1]
      const firstScore = first.positive - first.negative
      const lastScore = last.positive - last.negative
      onLastPointScore?.(lastScore)
      if (onVariance && Math.abs(firstScore) > 0) {
        const variancePct = Math.round(((lastScore - firstScore) / Math.abs(firstScore)) * 100)
        onVariance(variancePct)
      }
    }
  }, [timeSeriesData, onLastPointScore, onVariance])

  const hasChartData = timeSeriesData.length > 0

  if (!valid || !hasChartData) {
    const noData = !chartData?.sentiment
    return (
      <div className="space-y-6 antialiased" role="status" aria-label="감성 차트 데이터 대기 중">
        <div className="rounded-xl border border-border dark:border-slate-800 bg-muted/30 dark:bg-slate-900/50 p-6 ring-1 ring-border/50 dark:ring-slate-700/50 shadow-lg">
          <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-4 antialiased">
            24시간 감성 변화 추이
          </h3>
          <ChartSkeleton />
          <p className="text-muted-foreground dark:text-slate-500 text-xs mt-3 text-center">
            {noData ? '데이터가 없어요. 분석이 완료되면 차트가 표시됩니다.' : '분석이 완료되면 차트가 표시됩니다.'}
          </p>
        </div>
        <p className="text-xs text-muted-foreground dark:text-slate-400 pt-1 antialiased">
          ※ 본 지표는 AI가 수집된 뉴스를 분석하여 생성한 추정치입니다.
        </p>
      </div>
    )
  }

  const toggleVisibility = (key: 'positive' | 'neutral' | 'negative') => {
    setVisible((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const legendItems = [
    { key: 'positive' as const, label: SENTIMENT_LABELS.positive, pct: percentages.positive, color: SENTIMENT_COLORS.positive },
    { key: 'neutral' as const, label: SENTIMENT_LABELS.neutral, pct: percentages.neutral, color: SENTIMENT_COLORS.neutral },
    { key: 'negative' as const, label: SENTIMENT_LABELS.negative, pct: percentages.negative, color: SENTIMENT_COLORS.negative },
  ]

  const tooltipNews = marketNews.slice(0, 3).join(' · ') || null

  return (
    <div className="space-y-6 antialiased">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 ring-1 ring-slate-700/50 shadow-lg">
        <div className="flex flex-wrap items-start gap-4 mb-4">
          <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] antialiased shrink-0">
            24시간 감성 변화 추이
          </h3>
          {/* 현재 감성 요약 칩 (듀얼 뷰) */}
          <div className="flex items-center gap-2 shrink-0 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5">
            <div className="flex gap-0.5">
              <span
                className="w-2 h-6 rounded-sm"
                style={{ backgroundColor: SENTIMENT_COLORS.positive, flex: percentages.positive }}
                title={SENTIMENT_LABELS.positive}
              />
              <span
                className="w-2 h-6 rounded-sm"
                style={{ backgroundColor: SENTIMENT_COLORS.neutral, flex: Math.max(1, percentages.neutral) }}
                title={SENTIMENT_LABELS.neutral}
              />
              <span
                className="w-2 h-6 rounded-sm"
                style={{ backgroundColor: SENTIMENT_COLORS.negative, flex: percentages.negative }}
                title={SENTIMENT_LABELS.negative}
              />
            </div>
            <span className="text-xs text-slate-400 tabular-nums">
              {percentages.positive}/{percentages.neutral}/{percentages.negative}%
            </span>
          </div>
        </div>

        <div className="relative w-full min-h-[240px] rounded-lg bg-slate-800/50">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={timeSeriesData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="sentiment-line-positive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={FILL_OPACITY} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sentiment-line-neutral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={FILL_OPACITY} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sentiment-line-negative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fb7185" stopOpacity={FILL_OPACITY} />
                  <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.35} vertical={false} />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, 24]}
                ticks={[...X_TICK_HOURS]}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={false}
                tickFormatter={formatHourLabel}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={false}
                tickLine={{ stroke: '#475569' }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const p = payload[0]?.payload as { hour: number; positive: number; neutral: number; negative: number }
                  if (!p) return null
                  return (
                    <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs shadow-lg space-y-1.5 max-w-xs">
                      <p className="font-medium text-slate-200">{formatHourLabel(p.hour)} 시점</p>
                      <p><span className="text-emerald-400">긍정</span> {p.positive}% · <span className="text-slate-400">중립</span> {p.neutral}% · <span className="text-rose-400">부정</span> {p.negative}%</p>
                      {tooltipNews && (
                        <p className="text-slate-500 pt-1 border-t border-slate-600 mt-1">참고: {tooltipNews}</p>
                      )}
                    </div>
                  )
                }}
              />
              <Legend
                wrapperStyle={{ paddingTop: 8 }}
                content={() => (
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                    {legendItems.map((item) => {
                      const isVisible = visible[item.key]
                      return (
                        <span
                          key={item.key}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleVisibility(item.key)}
                          onKeyDown={(e) => e.key === 'Enter' && toggleVisibility(item.key)}
                          className="inline-flex items-center gap-2 text-sm cursor-pointer select-none opacity-90 hover:opacity-100"
                          style={{ opacity: isVisible ? 1 : 0.4 }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.label} {item.pct}%
                        </span>
                      )
                    })}
                  </div>
                )}
              />
              {visible.positive && (
                <>
                  <Area type="monotone" dataKey="positive" fill="url(#sentiment-line-positive)" stroke="none" isAnimationActive={false} />
                  <Line type="monotone" dataKey="positive" stroke={SENTIMENT_COLORS.positive} strokeWidth={STROKE_WIDTH} strokeOpacity={1} dot={false} isAnimationActive={false} name={SENTIMENT_LABELS.positive} />
                </>
              )}
              {visible.neutral && (
                <>
                  <Area type="monotone" dataKey="neutral" fill="url(#sentiment-line-neutral)" stroke="none" isAnimationActive={false} />
                  <Line type="monotone" dataKey="neutral" stroke={SENTIMENT_COLORS.neutral} strokeWidth={STROKE_WIDTH} strokeOpacity={1} dot={false} isAnimationActive={false} name={SENTIMENT_LABELS.neutral} />
                </>
              )}
              {visible.negative && (
                <>
                  <Area type="monotone" dataKey="negative" fill="url(#sentiment-line-negative)" stroke="none" isAnimationActive={false} />
                  <Line type="monotone" dataKey="negative" stroke={SENTIMENT_COLORS.negative} strokeWidth={STROKE_WIDTH} strokeOpacity={1} dot={false} isAnimationActive={false} name={SENTIMENT_LABELS.negative} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-slate-500/80 mt-2 antialiased">범례 클릭 시 해당 감성 선만 표시/숨김</p>
      </div>
      <p className="text-xs text-slate-400 pt-1 antialiased">
        ※ 본 지표는 AI가 수집된 뉴스를 분석하여 생성한 추정치입니다.
      </p>
    </div>
  )
}
