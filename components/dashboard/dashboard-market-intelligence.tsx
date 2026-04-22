'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import type { TrendItem } from '@/lib/trends-types'
import { cn } from '@/lib/utils'
import { OpportunityRiskScatter } from '@/components/dashboard/opportunity-risk-scatter'
import type { ScatterKeywordPoint } from '@/lib/types/scatter-keyword-point'

const sectionTitle = 'text-[14px] font-semibold tracking-[-0.01em] text-[#374151] dark:text-zinc-300'

function shortLabel(s: string, n = 5) {
  const t = s.trim()
  return t.length <= n ? t : `${t.slice(0, n)}…`
}

function CategoryXAxisTick({
  x = 0,
  y = 0,
  payload,
}: {
  x?: number
  y?: number
  payload?: { value?: string }
}) {
  const raw = String(payload?.value ?? '')
  const maxChars = 8
  const display = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" fill="currentColor" fontSize={10} transform="rotate(-35)" className="fill-[#6B7280]" dy={10}>
        <title>{raw}</title>
        {display}
      </text>
    </g>
  )
}

export function DashboardMarketIntelligence({
  scatterData,
  scatterLoading,
  trendItems,
  trendsLoading,
  topOpportunities,
  countryCode,
  className,
}: {
  scatterData: ScatterKeywordPoint[]
  scatterLoading: boolean
  trendItems: TrendItem[]
  trendsLoading: boolean
  topOpportunities: Array<{ keyword: string; score: number; sub: string }>
  countryCode: string
  className?: string
}) {
  const trendLineData = trendItems.slice(0, 10).map((t, i) => ({
    name: shortLabel(t.keyword, 4),
    full: t.keyword,
    관심도: Math.max(14, 92 - i * 6 - (typeof t.rank === 'number' ? t.rank : 0)),
  }))
  const trendVals = trendLineData.map((d) => d.관심도)
  const tMin = trendVals.length ? Math.min(...trendVals) : 0
  const tMax = trendVals.length ? Math.max(...trendVals) : 100
  const tSpan = Math.max(8, tMax - tMin)
  const tPad = Math.max(4, tSpan * 0.12)
  const trendYLow = Math.max(0, Math.floor(tMin - tPad))
  const trendYHigh = Math.min(100, Math.ceil(tMax + tPad))

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-4', className)}>
      <div
        className="rounded-[12px] border border-[#E5E9F2] bg-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950 md:px-6"
        style={{ padding: '20px 24px' }}
      >
        <h2 className={sectionTitle}>기회·리스크 매트릭스</h2>
        <p className="mt-1 text-[12px] text-[#6B7280] dark:text-zinc-500">각 키워드를 기회·리스크 좌표로 배치했습니다. 버블 크기는 트렌드 강도입니다.</p>
        <div className="mt-4">
          <OpportunityRiskScatter data={scatterData} loading={scatterLoading} countryCode={countryCode} />
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <div
          className="rounded-[12px] border border-[#E5E9F2] bg-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950 md:px-6"
          style={{ padding: '20px 24px' }}
        >
          <h2 className={sectionTitle}>트렌드 성장 추이</h2>
          <p className="mt-1 text-[12px] text-[#6B7280] dark:text-zinc-500">상위 키워드 관심도 추정</p>
          <div className="mt-3 h-[220px] w-full min-h-[200px]">
            {trendsLoading ? (
              <div className="h-full animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-900" />
            ) : trendLineData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-center text-sm text-[#6B7280]">표시할 트렌드가 없습니다</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendLineData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" vertical={false} />
                  <XAxis dataKey="name" interval={0} tick={<CategoryXAxisTick />} height={48} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} width={36} domain={[trendYLow, trendYHigh]} />
                  <Tooltip
                    formatter={(value: number) => [`${value}`, '관심도']}
                    labelFormatter={(_l, payload) => {
                      const p = payload?.[0]?.payload as { full?: string; name?: string } | undefined
                      return p?.full ?? p?.name ?? ''
                    }}
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E9F2', fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="관심도" stroke="#2563EB" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div
          className="rounded-[12px] border border-[#E5E9F2] bg-white px-5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950 md:px-6"
          style={{ padding: '20px 24px' }}
        >
          <h2 className={sectionTitle}>상위 기회 키워드</h2>
          <p className="mt-1 text-[12px] text-[#6B7280] dark:text-zinc-500">추정 기회 점수 상위 5개</p>
          <ol className="mt-4 space-y-3">
            {topOpportunities.length === 0 ? (
              <li className="text-sm text-[#6B7280]">키워드가 쌓이면 목록이 표시됩니다</li>
            ) : (
              topOpportunities.map((row, idx) => (
                <li
                  key={row.keyword}
                  className="flex items-center justify-between gap-3 border-b border-[#F3F4F6] pb-3 last:border-0 dark:border-zinc-800"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[13px] font-bold tabular-nums text-[#374151] dark:bg-zinc-800 dark:text-zinc-200">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-[#111827] dark:text-zinc-100">{row.keyword}</p>
                      <p className="truncate text-[11px] text-[#6B7280] dark:text-zinc-500">{row.sub}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[22px] font-bold tabular-nums text-[#111827] [font-variant-numeric:tabular-nums] dark:text-zinc-50">
                    {row.score}
                  </span>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </div>
  )
}
