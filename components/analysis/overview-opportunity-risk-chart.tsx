'use client'

import { motion } from 'framer-motion'
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
import { OpportunityChartSourceDialog } from '@/components/analysis/opportunity-chart-source-dialog'
import { RadarAngleEllipsisTick } from '@/components/analysis/radar-angle-tick'
import { cn } from '@/lib/utils'
import { CHART_GRAY_AXIS, CHART_GRAY_GRID, CHART_MINT, CHART_MINT_SOFT } from '@/lib/chart-theme'
import { breakdownToRadarDisplayRows } from '@/lib/chart/opportunity-radar-display'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'

function toRadarRows(
  breakdown: Record<string, number | undefined> | null | undefined,
  opportunityScore: number
): { subject: string; score: number; fullMark: number }[] {
  const base = breakdown && Object.keys(breakdown).length > 0 ? breakdown : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const rows = breakdownToRadarDisplayRows(base)
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
  const scoreReasoning = result?.key_metrics?.opportunity_score_reasoning
  const showSkeleton = loading && (result == null || scoreRaw == null)

  return (
    <div className={cn(analysisCardClass, 'p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">기회·리스크 다각도 뷰</h3>
        {!showSkeleton ? <OpportunityChartSourceDialog reasoning={scoreReasoning} breakdown={breakdown} /> : null}
      </div>
      {showSkeleton ? (
        <SectionContentSkeleton variant="chart" className="rounded-lg border-0 bg-transparent" />
      ) : (
        <motion.div
          className="aspect-square w-full min-h-[220px] max-h-[360px] px-2 pt-2 pb-3 sm:min-h-[240px] sm:max-h-[380px]"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={200} minHeight={240} debounce={32}>
            <RadarChart
              cx="50%"
              cy="50%"
              outerRadius="58%"
              margin={{ top: 40, right: 44, bottom: 40, left: 44 }}
              data={radarData}
            >
              <PolarGrid stroke={CHART_GRAY_GRID} />
              <PolarAngleAxis
                dataKey="subject"
                tick={(p) => <RadarAngleEllipsisTick {...p} fill={CHART_GRAY_AXIS} />}
              />
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
                isAnimationActive
                animationDuration={900}
                animationEasing="ease-out"
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      )}
    </div>
  )
}
