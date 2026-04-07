'use client'

import { OpportunityScoreGauge } from '@/components/analysis/opportunity-score-gauge'
import { UrgentTaskCards } from '@/components/analysis/urgent-task-cards'
import { analysisCardClass } from '@/components/analysis/analysis-card'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { ExpandableText } from '@/components/ui/expandable-text'

type Props = {
  effectiveResult: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{ step_name: string; output_data: unknown }> | null
  loading: boolean
  onNavigateTab: (tab: 'insight' | 'action') => void
  stableOpportunityScore?: number | null
  analysisFailed?: boolean
  scoreRationaleSummary?: string | null
  conclusionFull: string
}

export function ResultLeftRail({
  effectiveResult,
  taskData,
  analysisTasks,
  loading,
  onNavigateTab,
  stableOpportunityScore = null,
  analysisFailed = false,
  scoreRationaleSummary = null,
  conclusionFull,
}: Props) {
  const km = effectiveResult?.key_metrics ?? {}
  const score = typeof km.opportunity_score === 'number' ? km.opportunity_score : null

  return (
    <aside className="flex w-full flex-col gap-5 lg:sticky lg:top-20 lg:max-w-[340px] lg:shrink-0">
      <div className={cn(analysisCardClass, 'p-5')}>
        <OpportunityScoreGauge
          score={score}
          loading={loading && score == null}
          stableScore={stableOpportunityScore}
          analysisFailed={analysisFailed}
          rationaleSummary={scoreRationaleSummary}
        />
      </div>

      <div className={cn(analysisCardClass, 'p-5')}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">핵심 결론</h3>
        <div className="mt-3 text-sm font-medium leading-relaxed text-slate-900 dark:text-zinc-50 break-words">
          <ExpandableText
            text={conclusionFull}
            maxLength={160}
            expandMode="modal"
            modalTitle="핵심 결론 전체"
            className="block"
          />
        </div>
      </div>

      <UrgentTaskCards
        result={effectiveResult}
        taskData={taskData}
        analysisTasks={analysisTasks}
        onNavigateTab={onNavigateTab}
      />
    </aside>
  )
}
