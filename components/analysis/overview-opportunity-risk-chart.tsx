'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { analysisCardClass } from '@/components/analysis/analysis-card'
import { cn } from '@/lib/utils'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT, CHART_MINT_SOFT } from '@/lib/chart-theme'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'

const LABELS: Record<string, string> = {
  market_growth: '시장 성장',
  trend_momentum: '트렌드',
  competition_density: '경쟁 밀도',
  competition_pressure: '경쟁 압력',
  funding_signals: '투자 신호',
  risk_factors: '리스크 요인',
  user_demand: '수요',
  product_differentiation: '차별화',
  market_timing: '타이밍',
}

function toRadarRows(
  breakdown: Record<string, number | undefined> | null | undefined,
  opportunityScore: number
): { subject: string; score: number; fullMark: number }[] {
  const base = breakdown && Object.keys(breakdown).length > 0 ? breakdown : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const rows = Object.entries(base)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => ({
      subject: LABELS[k] ?? k,
      score: Math.min(100, Math.max(0, v as number)),
      fullMark: 100,
    }))
    .slice(0, 8)
  if (rows.length >= 4) return rows
  const s = Math.min(100, Math.max(0, Math.round(opportunityScore)))
  return [
    { subject: '기회', score: s, fullMark: 100 },
    { subject: '성장', score: Math.round(s * 0.9), fullMark: 100 },
    { subject: '수요', score: Math.round(s * 0.85), fullMark: 100 },
    { subject: '리스크 압력', score: Math.round(Math.max(0, 100 - s) * 0.75), fullMark: 100 },
    { subject: '타이밍', score: Math.round(s * 0.8), fullMark: 100 },
  ]
}

export function OverviewOpportunityRiskChart({
  result,
  loading = false,
  className,
}: {
  result: ResearchResponse | null
  className?: string
  loading?: boolean
}) {
  const scoreRaw = result?.key_metrics?.opportunity_score
  const score = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : 50
  const breakdown = result?.key_metrics?.opportunity_score_breakdown as Record<string, number | undefined> | undefined
  const radarData = toRadarRows(breakdown, score)
  const showSkeleton = loading && (result == null || scoreRaw == null)

  return (
    <div className={cn(analysisCardClass, 'p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">기회·리스크 다각도 뷰</h3>
      </div>
      {showSkeleton ? (
        <SectionContentSkeleton variant="chart" className="rounded-lg border-0 bg-transparent" />
      ) : (
        <div className="aspect-square w-full min-h-[200px] max-h-[320px] sm:min-h-[220px] sm:max-h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="78%" data={radarData}>
              <PolarGrid stroke={CHART_GRAY_GRID} />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: CHART_GRAY_AXIS }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9, fill: CHART_GRAY_AXIS }} />
              <Tooltip
                formatter={(v: number) => [`${v}/100`, '']}
                contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
              />
              <Radar
                name="프로필"
                dataKey="score"
                stroke={CHART_MINT}
                fill={CHART_MINT_SOFT}
                fillOpacity={0.4}
                strokeWidth={2}
                dot={{ r: 2, fill: CHART_MINT }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
