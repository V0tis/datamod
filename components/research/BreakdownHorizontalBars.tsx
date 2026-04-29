'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  chartAxisMuted,
  chartGridMuted,
  chartFontFamily,
  formatChartInt,
  getFactorStrengthBarColor,
} from '@/lib/chartTheme'
import { porterFiveScoreTo10 } from '@/lib/score-display'
import { cn } from '@/lib/utils'
import { ChartSourceFooter } from '@/components/research/chart-source-footer'

export type BreakdownBarRow = { label: string; value: number; fullMark?: number }

function riskSeverityFill(v: number, vmax: number): string {
  const t = vmax > 0 ? v / vmax : 0
  if (t >= 0.82) return '#dc2626'
  if (t >= 0.62) return '#ea580c'
  if (t >= 0.42) return '#f97316'
  if (t >= 0.22) return '#f59e0b'
  return '#94a3b8'
}

export function BreakdownHorizontalBars({
  rows,
  valueLabel = '점수',
  maxDomain,
  className,
  heightClass = 'min-h-[220px] max-h-[400px]',
  showSource = true,
  variant = 'default',
}: {
  rows: BreakdownBarRow[]
  valueLabel?: string
  maxDomain?: number
  className?: string
  heightClass?: string
  showSource?: boolean
  variant?: 'default' | 'risk'
}) {
  const data = rows.map((r) => ({
    ...r,
    v: Math.round(Number.isFinite(r.value) ? r.value : 0),
  }))
  const vmax = Math.max(...data.map((d) => d.v), 1)
  const cap = maxDomain ?? Math.min(100, Math.ceil(vmax * 1.08 + 2))
  const avg = data.length ? data.reduce((s, d) => s + d.v, 0) / data.length : 0

  const chartStyle = { fontFamily: chartFontFamily } as const
  /** ReferenceLine `평균` 라벨(position: top)이 잘리지 않도록 — 인사이트 박스 바로 아래에서도 보이게 */
  const marginTop = variant === 'default' ? 42 : 10

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full', heightClass)}>
        <ResponsiveContainer width="100%" height="100%" minHeight={220} debounce={32}>
          <BarChart data={data} layout="vertical" margin={{ left: 36, right: 52, top: marginTop, bottom: 10 }} style={chartStyle}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartGridMuted} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, cap]}
              tick={{ fontSize: 11, fill: chartAxisMuted }}
              tickLine={false}
              axisLine={{ stroke: chartGridMuted }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={128}
              tick={{ fontSize: 11, fill: chartAxisMuted }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            {variant === 'default' ? (
              <ReferenceLine
                x={avg}
                stroke="#64748B"
                strokeDasharray="4 4"
                strokeWidth={1.25}
                label={{
                  value: `평균 ${formatChartInt(Math.round(avg))}`,
                  position: 'top',
                  fill: '#64748B',
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            ) : null}
            <Tooltip
              formatter={(v: number) => {
                const isPorter5 = data[0]?.fullMark === 5
                const display = isPorter5 ? porterFiveScoreTo10(Number(v)) : formatChartInt(v)
                const suffix = isPorter5 ? '/10' : ''
                return [`${display}${suffix}`, valueLabel]
              }}
              contentStyle={{
                fontFamily: chartFontFamily,
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid var(--border)',
              }}
            />
            <Bar
              dataKey="v"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              name={valueLabel}
              isAnimationActive
              animationDuration={700}
              fill={variant === 'risk' ? '#ea580c' : getFactorStrengthBarColor(50)}
            >
              {variant === 'risk'
                ? data.map((d, i) => <Cell key={`risk-${d.label}-${i}`} fill={riskSeverityFill(d.v, vmax)} />)
                : data.map((d, i) => (
                    <Cell key={`strength-${d.label}-${i}`} fill={getFactorStrengthBarColor(d.v)} />
                  ))}
              <LabelList
                dataKey="v"
                position="right"
                formatter={(v: number) => formatChartInt(v)}
                style={{ fill: '#374151', fontSize: 12, fontWeight: 600 }}
                className=""
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showSource ? <ChartSourceFooter /> : null}
    </div>
  )
}
