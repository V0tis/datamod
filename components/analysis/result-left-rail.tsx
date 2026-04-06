'use client'

import { OpportunityScoreGauge } from '@/components/analysis/opportunity-score-gauge'
import { UrgentTaskCards } from '@/components/analysis/urgent-task-cards'
import { analysisCardClass } from '@/components/analysis/analysis-card'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'

function oneLineConclusion(raw: string | undefined | null): string {
  const t = (raw ?? '').trim()
  if (!t) return '핵심 전략 방향을 분석 완료 후 확인할 수 있습니다.'
  const first = t.split(/\n/).map((s) => s.trim()).find(Boolean) ?? t
  return first.length > 160 ? `${first.slice(0, 157)}…` : first
}

type Props = {
  effectiveResult: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{ step_name: string; output_data: unknown }> | null
  loading: boolean
  onNavigateTab: (tab: 'insight' | 'action') => void
}

export function ResultLeftRail({ effectiveResult, taskData, analysisTasks, loading, onNavigateTab }: Props) {
  const km = effectiveResult?.key_metrics ?? {}
  const score = typeof km.opportunity_score === 'number' ? km.opportunity_score : null
  const conclusion = oneLineConclusion(km.summary_insights)

  return (
    <aside className="flex w-full flex-col gap-5 lg:sticky lg:top-20 lg:max-w-[340px] lg:shrink-0">
      <div className={cn(analysisCardClass, 'p-5')}>
        <OpportunityScoreGauge score={score} loading={loading && score == null} />
      </div>

      <div className={cn(analysisCardClass, 'p-5')}>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">핵심 결론</h3>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-900 dark:text-zinc-50">{conclusion}</p>
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
