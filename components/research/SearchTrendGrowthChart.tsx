'use client'

import { useEffect, useId, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { chartFontFamily } from '@/lib/chartTheme'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID } from '@/lib/chart-theme'

export type SearchTrendPoint = { month: string; value: number }

const PRIMARY = 'var(--color-primary)'

export function SearchTrendGrowthChart({ data }: { data: SearchTrendPoint[] }) {
  const gradId = useId().replace(/:/g, '')
  const [dash, setDash] = useState('0 2400')

  useEffect(() => {
    const t0 = performance.now()
    let raf = 0
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / 800)
      const len = 2400 * p
      setDash(`${len} 2400`)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="h-[200px] w-full" style={{ fontFamily: chartFontFamily }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.2} />
              <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_GRAY_GRID} strokeDasharray="3 3" vertical={false} horizontal />
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} tickLine={false} axisLine={{ stroke: CHART_GRAY_GRID }} />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: CHART_GRAY_AXIS, width: 28 }}
            tickLine={false}
            axisLine={{ stroke: CHART_GRAY_GRID }}
          />
          <Tooltip
            formatter={(v: number) => [`${v} / 100`, '검색 관심도']}
            labelFormatter={(l) => String(l)}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid var(--border)',
              fontFamily: chartFontFamily,
            }}
            cursor={{ stroke: 'rgba(27,100,218,0.25)', strokeWidth: 1 }}
          />
          <Area
            type="natural"
            dataKey="value"
            stroke="none"
            fill={`url(#${gradId})`}
            fillOpacity={1}
            isAnimationActive={false}
          />
          <Line
            type="natural"
            dataKey="value"
            stroke={PRIMARY}
            strokeWidth={2}
            strokeDasharray={dash}
            dot={{ r: 5, fill: PRIMARY, stroke: '#fff', strokeWidth: 2 }}
            activeDot={{ r: 6, strokeWidth: 2 }}
            isAnimationActive={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
