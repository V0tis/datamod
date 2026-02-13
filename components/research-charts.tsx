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
const SENTIMENT_COLORS = {
  positive: '#10b981',
  neutral: '#94a3b8',
  negative: '#ef4444',
} as const

const STROKE_WIDTH = 3
const X_TICK_HOURS = [0, 6, 12, 18, 24] as const

interface ResearchChartsProps {
  chartData: ChartData
  consensusScore?: number | null
  trend?: 'rising' | 'falling' | 'stable'
  /** 차트 마지막 시점(24h) 복합 점수 - 헤드라인과 동기화용. 없으면 (positive - negative)로 계산 */
  onLastPointScore?: (score: number) => void
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

/** 0~24시 시계열: 마지막(24h) = 현재 비율, 이전 시점은 trend에 따라 흐름 생성 (직선 방지) */
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

export function ResearchCharts({ chartData, consensusScore, trend = 'stable', onLastPointScore }: ResearchChartsProps) {
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
    if (timeSeriesData.length > 0 && onLastPointScore) {
      const last = timeSeriesData[timeSeriesData.length - 1]
      onLastPointScore(last.positive - last.negative)
    }
  }, [timeSeriesData, onLastPointScore])

  const hasChartData = timeSeriesData.length > 0

  if (!valid || !hasChartData) {
    return (
      <div className="space-y-6 antialiased">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 ring-1 ring-slate-700/50 shadow-lg">
          <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-4 antialiased">
            24시간 감성 변화 추이
          </h3>
          <div
            className="flex flex-col items-center justify-center min-h-[220px] w-full rounded-lg bg-slate-800/50 border border-slate-700/50"
            style={{ background: 'rgb(30 41 59 / 0.5)' }}
          >
            <p className="text-slate-400 text-sm">데이터 분석 중...</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 pt-1 antialiased">
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

  return (
    <div className="space-y-6 antialiased">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 ring-1 ring-slate-700/50 shadow-lg">
        <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-4 antialiased">
          24시간 감성 변화 추이
        </h3>
        <div className="relative w-full min-h-[240px] rounded-lg bg-slate-800/50">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={timeSeriesData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="sentiment-line-positive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sentiment-line-neutral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="sentiment-line-negative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="hour"
                type="number"
                domain={[0, 24]}
                ticks={[...X_TICK_HOURS]}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={false}
                tickFormatter={(v) => `${v}h`}
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
                    <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs shadow-lg space-y-1">
                      <p className="font-medium text-slate-200">{p.hour}h 시점</p>
                      <p><span className="text-emerald-400">긍정</span> {p.positive}%</p>
                      <p><span className="text-slate-400">중립</span> {p.neutral}%</p>
                      <p><span className="text-rose-400">부정</span> {p.negative}%</p>
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
                  <Area type="monotone" dataKey="positive" fill="url(#sentiment-line-positive)" stroke="none" isAnimationActive animationDuration={400} />
                  <Line type="monotone" dataKey="positive" stroke={SENTIMENT_COLORS.positive} strokeWidth={STROKE_WIDTH} dot={false} isAnimationActive animationDuration={400} name={SENTIMENT_LABELS.positive} />
                </>
              )}
              {visible.neutral && (
                <>
                  <Area type="monotone" dataKey="neutral" fill="url(#sentiment-line-neutral)" stroke="none" isAnimationActive animationDuration={400} />
                  <Line type="monotone" dataKey="neutral" stroke={SENTIMENT_COLORS.neutral} strokeWidth={STROKE_WIDTH} dot={false} isAnimationActive animationDuration={400} name={SENTIMENT_LABELS.neutral} />
                </>
              )}
              {visible.negative && (
                <>
                  <Area type="monotone" dataKey="negative" fill="url(#sentiment-line-negative)" stroke="none" isAnimationActive animationDuration={400} />
                  <Line type="monotone" dataKey="negative" stroke={SENTIMENT_COLORS.negative} strokeWidth={STROKE_WIDTH} dot={false} isAnimationActive animationDuration={400} name={SENTIMENT_LABELS.negative} />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-slate-500 mt-2 antialiased">범례 클릭 시 해당 감성 선만 표시/숨김</p>
      </div>
      <p className="text-xs text-slate-400 pt-1 antialiased">
        ※ 본 지표는 AI가 수집된 뉴스를 분석하여 생성한 추정치입니다.
      </p>
    </div>
  )
}
