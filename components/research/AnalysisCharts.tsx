'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartWithInsight } from './ChartWithInsight'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { CHART_GRAY_AXIS, CHART_MINT } from '@/lib/chart-theme'

const CHART_COLORS = [CHART_MINT, '#94a3b8', '#64748b', '#cbd5e1', '#2dd4bf', '#475569', '#99f6e4', '#334155']

export interface BreakdownItem {
  name: string
  value: number
  label: string
}

function breakdownToData(breakdown: Record<string, number | undefined>): BreakdownItem[] {
  const labels: Record<string, string> = {
    market_growth: '시장 성장',
    trend_momentum: '트렌드 모멘텀',
    competition_density: '경쟁 밀도',
    competition_pressure: '경쟁 압력',
    funding_signals: '투자 신호',
    risk_factors: '리스크 요인',
    user_demand: '수요',
    product_differentiation: '차별화',
    market_timing: '시장 타이밍',
  }
  return Object.entries(breakdown)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => ({
      name: labels[k] ?? k,
      value: v as number,
      label: labels[k] ?? k,
    }))
    .slice(0, 8)
}

export interface AnalysisChartsProps {
  opportunityScoreBreakdown?: Record<string, number | undefined>
  chartInsights?: { score_distribution?: { insight?: string; takeaway?: string } }
  className?: string
}

export function MarketGrowthChart({ breakdown, className }: { breakdown: Record<string, number | undefined>; className?: string }) {
  const data = breakdownToData(breakdown)
  if (data.length === 0) return null
  return (
    <div className={cn('aspect-video w-full min-h-[200px] max-h-[380px] sm:min-h-[220px]', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }} />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }} />
          <Tooltip
            formatter={(v: number) => [`${v}/100`, '점수']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            cursor={false}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            maxBarSize={24}
            isAnimationActive
            animationDuration={850}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnalysisCharts({ opportunityScoreBreakdown, chartInsights, className }: AnalysisChartsProps) {
  const breakdown =
    opportunityScoreBreakdown && Object.keys(opportunityScoreBreakdown).length > 0
      ? opportunityScoreBreakdown
      : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const data = breakdownToData(breakdown)
  if (data.length === 0) return null

  const sd = chartInsights?.score_distribution

  return (
    <ChartWithInsight
      title="시장 점수 분포"
      insight={sd?.insight}
      takeaway={sd?.takeaway}
      className={className}
    >
      <div className="aspect-video w-full min-h-[200px] max-h-[380px] sm:min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 4 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }} />
            <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: CHART_GRAY_AXIS }} />
            <Tooltip
              formatter={(v: number) => [`${v}/100`, '점수']}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              cursor={false}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              isAnimationActive
              animationDuration={850}
              animationEasing="ease-out"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} opacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartWithInsight>
  )
}
