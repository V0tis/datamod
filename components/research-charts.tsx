'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { ChartData } from '@/lib/stores/research-store'

const SENTIMENT_LABELS = {
  positive: '긍정적 신호',
  neutral: '중립 유지',
  negative: '부정적 리스크',
} as const
const SENTIMENT_COLORS_HEX = ['#10b981', '#94a3b8', '#ef4444'] as const

interface ResearchChartsProps {
  chartData: ChartData
  /** Consensus 점수(-100~100)가 있으면 차트 최종 시점과 헤드라인에 반영 */
  consensusScore?: number | null
  /** Consensus 트렌드: 추이 기울기 및 헤드라인 문구에 사용 */
  trend?: 'rising' | 'falling' | 'stable'
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

/** 24시간 구간별 데이터: 긍정/중립/부정 비중(%)을 매 시점에 동일하게 적용 (현재 스냅샷 기준) */
function build24hStackedSeries(
  positivePct: number,
  neutralPct: number,
  negativePct: number
): Array<{ hour: number; hourLabel: string; positive: number; neutral: number; negative: number }> {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    hourLabel: i === 0 ? '0h' : i === 23 ? '24h' : `${i}h`,
    positive: positivePct,
    neutral: neutralPct,
    negative: negativePct,
  }))
}

export function ResearchCharts({ chartData, consensusScore, trend = 'stable' }: ResearchChartsProps) {
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
  const areaData = valid
    ? build24hStackedSeries(percentages.positive, percentages.neutral, percentages.negative)
    : []
  const hasChartData = areaData.length > 0

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

  const legendItems = [
    { key: 'positive' as const, label: SENTIMENT_LABELS.positive, pct: percentages.positive, color: SENTIMENT_COLORS_HEX[0] },
    { key: 'neutral' as const, label: SENTIMENT_LABELS.neutral, pct: percentages.neutral, color: SENTIMENT_COLORS_HEX[1] },
    { key: 'negative' as const, label: SENTIMENT_LABELS.negative, pct: percentages.negative, color: SENTIMENT_COLORS_HEX[2] },
  ]

  return (
    <div className="space-y-6 antialiased">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 ring-1 ring-slate-700/50 shadow-lg">
        <h3 className="text-sm font-semibold text-foreground dark:text-[#e1e3e6] mb-4 antialiased">
          24시간 감성 변화 추이
        </h3>
        <div className="relative w-full min-h-[220px] rounded-lg bg-slate-800/50">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={areaData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <defs>
                <linearGradient id="sentiment-stack-positive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="sentiment-stack-neutral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.25} />
                </linearGradient>
                <linearGradient id="sentiment-stack-negative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.25} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="hourLabel"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={{ stroke: '#475569' }}
                tickLine={false}
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
              <Area type="monotone" dataKey="positive" stackId="sentiment" fill="url(#sentiment-stack-positive)" stroke="#10b981" strokeWidth={1} isAnimationActive animationDuration={400} name={SENTIMENT_LABELS.positive} />
              <Area type="monotone" dataKey="neutral" stackId="sentiment" fill="url(#sentiment-stack-neutral)" stroke="#94a3b8" strokeWidth={1} isAnimationActive animationDuration={400} name={SENTIMENT_LABELS.neutral} />
              <Area type="monotone" dataKey="negative" stackId="sentiment" fill="url(#sentiment-stack-negative)" stroke="#ef4444" strokeWidth={1} isAnimationActive animationDuration={400} name={SENTIMENT_LABELS.negative} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-4">
          {legendItems.map((item) => (
            <div
              key={item.key}
              className="inline-flex items-center gap-2 text-sm text-slate-200"
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span>{item.label}</span>
              <span className="tabular-nums text-slate-400">{item.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400 pt-1 antialiased">
        ※ 본 지표는 AI가 수집된 뉴스를 분석하여 생성한 추정치입니다.
      </p>
    </div>
  )
}
