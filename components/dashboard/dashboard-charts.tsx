'use client'

import { Info } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from 'recharts'
import type { DashboardKeywordRow } from '@/lib/types/dashboard-keyword-row'
import type { TrendItem } from '@/lib/trends-types'
import { cn } from '@/lib/utils'
import { Tooltip as UiTooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const tickStyle = { fontSize: 10, fill: '#6b7280' }
const gridStroke = '#E5E7EB'

const DASHBOARD_CHART_LOGIC = {
  trendLine:
    '상위 키워드의 관심도 추정치를 꺾은선으로 표시합니다. Y축은 표시 구간을 데이터에 맞춰 확대합니다. 아래 막대는 목록 평균 대비 편차입니다.',
  opportunity:
    '워크스페이스에 저장된 분석의 기회 점수를 키워드별로 막대로 보여 줍니다.',
  compare: '같은 키워드에 대해 기회 점수와 리스크 점수를 나란히 비교합니다.',
} as const

function ChartTitleWithInfo({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 ">{title}</p>
      <TooltipProvider delayDuration={200}>
        <UiTooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700  "
              aria-label="이 데이터는 어떻게 산출되었는가"
            >
              <Info className="h-3.5 w-3.5" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
            {hint}
          </TooltipContent>
        </UiTooltip>
      </TooltipProvider>
    </div>
  )
}

/** X축 카테고리: -45° + 말줄임(전체 문자열은 SVG title로 표시) */
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
  const maxChars = 12
  const display = raw.length > maxChars ? `${raw.slice(0, maxChars)}…` : raw
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        textAnchor="end"
        fill="currentColor"
        fontSize={10}
        transform="rotate(-45)"
        className="fill-slate-500 "
        dy={12}
      >
        <title>{raw}</title>
        {display}
      </text>
    </g>
  )
}

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
  const trendVals = trendLineData.map((d) => d.관심도)
  const tMin = trendVals.length ? Math.min(...trendVals) : 0
  const tMax = trendVals.length ? Math.max(...trendVals) : 100
  const tSpan = Math.max(6, tMax - tMin)
  const tPad = Math.max(3, tSpan * 0.14)
  const trendYLow = Math.max(0, Math.floor(tMin - tPad))
  const trendYHigh = Math.min(100, Math.ceil(tMax + tPad))
  const trendAvg = trendVals.length ? trendVals.reduce((a, b) => a + b, 0) / trendVals.length : 0
  const trendDeltaData = trendLineData.map((d) => ({
    name: d.name,
    편차: Math.round(d.관심도 - trendAvg),
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
              'animate-pulse rounded-lg bg-slate-100 '
            )}
          />
        ))}
      </div>
    )
  }

  const emptyHint = (msg: string) => <p className="py-8 text-center text-xs text-slate-500 ">{msg}</p>

  return (
    <div className={layoutClass}>
      <div>
        <ChartTitleWithInfo title="트렌드" hint={DASHBOARD_CHART_LOGIC.trendLine} />
        {trendLineData.length === 0 ? (
          emptyHint('트렌드가 쌓이면 꺾은선으로 표시됩니다')
        ) : (
          <div className="space-y-3">
            <div className={chartFrameClass}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendLineData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={<CategoryXAxisTick />}
                    height={56}
                  />
                  <YAxis tick={tickStyle} width={36} domain={[trendYLow, trendYHigh]} />
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
            <p className="text-[10px] text-slate-500 ">평균 대비 편차 (상위 키워드 목록 기준)</p>
            <div className="aspect-[16/5] w-full min-h-[100px] max-h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendDeltaData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                  <XAxis dataKey="name" interval={0} tick={<CategoryXAxisTick />} height={52} />
                  <YAxis tick={tickStyle} width={32} domain={['auto', 'auto']} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #E5E7EB',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="편차" radius={[2, 2, 0, 0]} maxBarSize={14}>
                    {trendDeltaData.map((e, i) => (
                      <Cell key={`d-${e.name}-${i}`} fill={e.편차 >= 0 ? '#2563eb' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div>
        <ChartTitleWithInfo title="기회 점수" hint={DASHBOARD_CHART_LOGIC.opportunity} />
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
        <ChartTitleWithInfo title="기회 vs 리스크" hint={DASHBOARD_CHART_LOGIC.compare} />
        {compareData.length === 0 ? (
          emptyHint('기회 키워드가 생기면 비교됩니다')
        ) : (
          <div className={chartFrameClass}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={compareData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                <XAxis dataKey="name" interval={0} tick={<CategoryXAxisTick />} height={52} />
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
