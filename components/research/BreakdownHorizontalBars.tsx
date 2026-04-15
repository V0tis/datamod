'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT } from '@/lib/chart-theme'
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
  heightClass = 'min-h-[220px] max-h-[380px]',
  showSource = true,
  variant = 'default',
}: {
  rows: BreakdownBarRow[]
  valueLabel?: string
  /** 기본: 데이터 최댓값 기준 + 패딩 */
  maxDomain?: number
  className?: string
  heightClass?: string
  showSource?: boolean
  /** 리스크: 값이 클수록 붉은 톤 */
  variant?: 'default' | 'risk'
}) {
  const data = rows.map((r) => ({
    ...r,
    v: Math.round(Number.isFinite(r.value) ? r.value : 0),
  }))
  const vmax = Math.max(...data.map((d) => d.v), 1)
  const cap = maxDomain ?? Math.min(100, Math.ceil(vmax * 1.08 + 2))

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('w-full', heightClass)}>
        <ResponsiveContainer width="100%" height="100%" minHeight={200} debounce={32}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRAY_GRID} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, cap]}
              tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }}
              tickLine={false}
              axisLine={{ stroke: CHART_GRAY_GRID }}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={88}
              tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(v: number) => [`${v}${data[0]?.fullMark === 5 ? '/5' : ''}`, valueLabel]}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }}
            />
            <Bar dataKey="v" fill={variant === 'risk' ? '#ea580c' : CHART_MINT} radius={[0, 6, 6, 0]} maxBarSize={18} name={valueLabel}>
              {variant === 'risk'
                ? data.map((d, i) => (
                    <Cell key={`risk-${d.label}-${i}`} fill={riskSeverityFill(d.v, vmax)} />
                  ))
                : null}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {showSource ? <ChartSourceFooter /> : null}
    </div>
  )
}
