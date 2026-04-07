'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { DashboardKeywordRow } from '@/app/api/research/dashboard-recommendations/route'
import type { TrendItem } from '@/lib/trends-types'
import { cn } from '@/lib/utils'

const tickStyle = { fontSize: 10, fill: '#6b7280' }
const gridStroke = '#E5E7EB'

function shortLabel(s: string, n = 6) {
  const t = s.trim()
  return t.length <= n ? t : `${t.slice(0, n)}…`
}

export function DashboardChartsBlock({
  opportunities,
  risks,
  trendItems,
  loading,
  variant: _variant = 'grid',
}: {
  opportunities: DashboardKeywordRow[]
  risks: DashboardKeywordRow[]
  trendItems: TrendItem[]
  loading: boolean
  /** API 호환용; 레이아웃은 동일한 반응형 그리드(1/2/3열)를 씁니다. */
  variant?: 'grid' | 'stack'
}) {
  const trendLineData = trendItems.slice(0, 10).map((t, i) => ({
    name: shortLabel(t.keyword, 4),
    관심도: Math.max(12, 95 - i * 7 - (typeof t.rank === 'number' ? t.rank : 0)),
  }))

  const oppBarData = opportunities.slice(0, 6).map((o) => ({
    name: shortLabel(o.keyword),
    기회: o.opportunity_score,
  }))

  const riskMap = new Map(risks.map((r) => [r.keyword, r.risk_score]))
  const compareData = opportunities.slice(0, 6).map((o) => ({
    name: shortLabel(o.keyword, 5),
    기회: o.opportunity_score,
    리스크: riskMap.get(o.keyword) ?? Math.min(90, Math.round(100 - o.opportunity_score * 0.35 + 15)),
  }))

  const layoutClass = 'grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 md:gap-8'

  const chartFrameClass =
    'aspect-video w-full min-h-[200px] max-h-[360px] sm:min-h-[220px] lg:max-h-[400px]'

  if (loading) {
    return (
      <div className={layoutClass}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={cn(
              chartFrameClass,
              'animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-900'
            )}
          />
        ))}
      </div>
    )
  }

  const emptyHint = (msg: string) => <p className="py-8 text-center text-xs text-slate-500 dark:text-zinc-400">{msg}</p>

  return (
    <div className={layoutClass}>
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">트렌드</p>
        {trendLineData.length === 0 ? (
          emptyHint('트렌드가 쌓이면 꺾은선으로 표시됩니다')
        ) : (
          <div className={chartFrameClass}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendLineData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} interval={0} angle={-25} textAnchor="end" height={48} />
                <YAxis tick={tickStyle} width={36} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                />
                <Line type="monotone" dataKey="관심도" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">기회 점수</p>
        {oppBarData.length === 0 ? (
          emptyHint('분석 완료 후 막대 그래프가 표시됩니다')
        ) : (
          <div className={chartFrameClass}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={oppBarData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={tickStyle} />
                <YAxis type="category" dataKey="name" width={56} tick={tickStyle} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="기회" fill="#059669" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">기회 vs 리스크</p>
        {compareData.length === 0 ? (
          emptyHint('기회 키워드가 생기면 비교됩니다')
        ) : (
          <div className={chartFrameClass}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData} margin={{ top: 4, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} interval={0} angle={-20} textAnchor="end" height={44} />
                <YAxis tick={tickStyle} width={32} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="기회" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="리스크" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
