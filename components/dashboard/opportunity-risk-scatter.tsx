'use client'

import Link from 'next/link'
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import type { ScatterKeywordPoint } from '@/lib/types/scatter-keyword-point'
import { cn } from '@/lib/utils'

export type { ScatterKeywordPoint }

function quadrantFill(o: number, r: number): string {
  const highO = o >= 50
  const highR = r >= 50
  if (highO && !highR) return '#059669'
  if (highO && highR) return '#D97706'
  if (!highO && !highR) return '#64748B'
  return '#DC2626'
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload: ScatterKeywordPoint }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const href = `/results?keyword=${encodeURIComponent(p.keyword)}${p.countryCode ? `&country=${encodeURIComponent(p.countryCode)}` : ''}`
  return (
    <div className="rounded-lg border border-[#E5E9F2] bg-white px-3 py-2 text-xs shadow-lg dark:border-zinc-600 dark:bg-zinc-900">
      <p className="font-semibold text-[#111827] dark:text-zinc-100">{p.keyword}</p>
      <p className="mt-1 tabular-nums text-[#374151] dark:text-zinc-300">
        기회 {Math.round(p.기회점수)} · 리스크 {Math.round(p.리스크점수)} · 강도 {Math.round(p.트렌드강도)}
      </p>
      <Link
        href={href}
        className="mt-2 inline-block text-[13px] font-semibold text-blue-600 hover:underline dark:text-sky-400"
      >
        분석 보기 →
      </Link>
    </div>
  )
}

export function OpportunityRiskScatter({
  data,
  loading,
  countryCode,
  className,
}: {
  data: ScatterKeywordPoint[]
  loading: boolean
  countryCode?: string
  className?: string
}) {
  const chartData = data.map((d) => ({
    ...d,
    countryCode: d.countryCode ?? countryCode,
  }))

  if (loading) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] w-full animate-pulse rounded-[12px] border border-[#E5E9F2] bg-slate-100 dark:border-zinc-700 dark:bg-zinc-900',
          className
        )}
      />
    )
  }

  if (chartData.length === 0) {
    return (
      <div
        className={cn(
          'flex min-h-[280px] w-full items-center justify-center rounded-[12px] border border-[#E5E9F2] bg-white px-4 text-center text-sm text-[#6B7280] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400',
          className
        )}
      >
        트렌드·분석 데이터가 쌓이면 기회·리스크 매트릭스에 표시됩니다.
      </div>
    )
  }

  return (
    <div className={cn('relative min-h-[280px] w-full', className)}>
      <div className="pointer-events-none absolute left-3 top-2 z-10 max-w-[45%] text-[10px] font-semibold leading-tight text-emerald-700/90 dark:text-emerald-300/90">
        고기회·저리스크 ✅
      </div>
      <div className="pointer-events-none absolute right-3 top-2 z-10 max-w-[45%] text-right text-[10px] font-semibold leading-tight text-amber-800/90 dark:text-amber-200/90">
        고기회·고리스크 ⚠️
      </div>
      <div className="pointer-events-none absolute bottom-8 left-3 z-10 max-w-[45%] text-[10px] font-semibold leading-tight text-slate-600 dark:text-zinc-400">
        저기회·저리스크
      </div>
      <div className="pointer-events-none absolute bottom-8 right-3 z-10 max-w-[45%] text-right text-[10px] font-semibold leading-tight text-red-800/90 dark:text-red-300/90">
        저기회·고리스크 ❌
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 28, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F2" />
          <XAxis
            type="number"
            dataKey="기회점수"
            name="기회 점수"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            label={{ value: '기회 점수', position: 'bottom', offset: 0, fill: '#374151', fontSize: 12 }}
          />
          <YAxis
            type="number"
            dataKey="리스크점수"
            name="리스크 점수"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: '#6B7280' }}
            label={{ value: '리스크 점수', angle: -90, position: 'insideLeft', fill: '#374151', fontSize: 12 }}
          />
          <ZAxis type="number" dataKey="트렌드강도" range={[40, 400]} />
          <ReferenceLine x={50} stroke="#94A3B8" strokeDasharray="4 4" />
          <ReferenceLine y={50} stroke="#94A3B8" strokeDasharray="4 4" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomTooltip />} />
          <Scatter name="키워드" data={chartData}>
            {chartData.map((entry, index) => (
              <Cell key={`${entry.keyword}-${index}`} fill={quadrantFill(entry.기회점수, entry.리스크점수)} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
