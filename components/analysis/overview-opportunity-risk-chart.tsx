'use client'

import { motion } from 'framer-motion'
import { Info } from 'lucide-react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { analysisCardClass } from '@/components/analysis/analysis-card'
import { OpportunityChartSourceDialog } from '@/components/analysis/opportunity-chart-source-dialog'
import { cn } from '@/lib/utils'
import { topRiskFactorRows } from '@/lib/chart/risk-factor-rows'
import { SectionContentSkeleton } from '@/components/research/SectionContentSkeleton'
import { BreakdownHorizontalBars } from '@/components/research/BreakdownHorizontalBars'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const RISK_CHART_LOGIC =
  '기회 점수 breakdown에서 리스크·경쟁·타이밍 관련 축을 골라 동일 스케일(0~100)로 환산한 뒤, 위험도가 높은 순으로 상위 5개만 표시합니다.'

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
  const barRows = topRiskFactorRows(breakdown, score)
  const km = result?.key_metrics
  const scoreReasoning =
    [
      typeof km?.opportunity_score_reason_text === 'string' ? km.opportunity_score_reason_text.trim() : '',
      typeof km?.opportunity_score_summary_text === 'string' ? km.opportunity_score_summary_text.trim() : '',
    ]
      .filter(Boolean)
      .join('\n\n') || undefined
  const showSkeleton = loading && (result == null || scoreRaw == null)

  return (
    <div className={cn(analysisCardClass, 'bg-white p-5 ', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-slate-900 ">리스크 요인 (상위 5)</h3>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground "
                  aria-label="이 데이터는 어떻게 산출되었는가"
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[280px] text-xs leading-relaxed">
                {RISK_CHART_LOGIC}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
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
          <BreakdownHorizontalBars
            rows={barRows}
            valueLabel="위험도(상대)"
            maxDomain={100}
            heightClass="min-h-[240px] max-h-[400px]"
            variant="risk"
            showSource
          />
        </motion.div>
      )}
    </div>
  )
}
