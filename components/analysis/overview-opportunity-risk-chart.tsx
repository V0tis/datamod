'use client'

import { motion } from 'framer-motion'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { analysisCardClass } from '@/components/analysis/analysis-card'
import { OpportunityChartSourceDialog } from '@/components/analysis/opportunity-chart-source-dialog'
import { cn } from '@/lib/utils'
import { DEFAULT_OPPORTUNITY_BREAKDOWN } from '@/lib/research-defaults'
import { breakdownToRadarDisplayRows } from '@/lib/chart/opportunity-radar-display'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { BreakdownHorizontalBars } from '@/components/research/BreakdownHorizontalBars'

function toBarRows(
  breakdown: Record<string, number | undefined> | null | undefined,
  opportunityScore: number
): { label: string; value: number; fullMark: number }[] {
  const base = breakdown && Object.keys(breakdown).length > 0 ? breakdown : { ...DEFAULT_OPPORTUNITY_BREAKDOWN }
  const rows = breakdownToRadarDisplayRows(base as Record<string, number | undefined>)
  if (rows.length >= 4) {
    return rows.map((r) => ({ label: r.subject, value: r.score, fullMark: r.fullMark }))
  }
  const s = Math.min(100, Math.max(0, Math.round(opportunityScore)))
  return [
    { label: '기회', value: s, fullMark: 100 },
    { label: '성장', value: Math.round(s * 0.9), fullMark: 100 },
    { label: '수요', value: Math.round(s * 0.85), fullMark: 100 },
    { label: '리스크 압력', value: Math.round(Math.max(0, 100 - s) * 0.75), fullMark: 100 },
    { label: '타이밍', value: Math.round(s * 0.8), fullMark: 100 },
  ]
}

export function OverviewOpportunityRiskChart({
  result,
  loading = false,
  className,
}: {
  result: ResearchResponse | null
  loading?: boolean
  className?: string
}) {
  const scoreRaw = result?.key_metrics?.opportunity_score
  const score = typeof scoreRaw === 'number' && Number.isFinite(scoreRaw) ? scoreRaw : 50
  const breakdown = result?.key_metrics?.opportunity_score_breakdown as Record<string, number | undefined> | undefined
  const barRows = toBarRows(breakdown, score)
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
          className="w-full min-h-[220px] px-1 pt-1 pb-2"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
        >
          <BreakdownHorizontalBars rows={barRows} valueLabel="지표" maxDomain={100} heightClass="min-h-[240px] max-h-[400px]" />
        </motion.div>
      )}
    </div>
  )
}
