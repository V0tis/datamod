'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SectionHeader } from '@/components/analysis/shared/SectionHeader'
import { StrategyEvaluationSection } from '@/components/research/StrategyEvaluationSection'
import { StrategyExecutionTable } from '@/components/analysis/strategy-execution-table'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'
import {
  buildOutcomeMetricItems,
  isExecutionLayerBusy,
  isExecutionLayerComplete,
  isExecutionLayerFailed,
  normalizeActionTimeline,
  urgencyToPriorityLevel,
} from '@/lib/research-priority-outcomes'
import { MarkdownBody } from '@/components/ui/markdown-body'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { PmExecutionReadinessHeader } from './pm-execution-readiness-header'
import { PrioritySuggestionsCard } from './priority-suggestions-card'
import { ExpectedOutcomesCard } from './expected-outcomes-card'

type AnalysisTask = {
  step_name: string
  status: string
  output_data: unknown
}

function confidencePercentFromResult(result: ResearchResponse | null): number | null {
  const km = result?.key_metrics
  const cv = km?.strategy_evaluation?.cross_validation_score
  if (typeof cv === 'number' && Number.isFinite(cv)) {
    return Math.round(Math.min(100, Math.max(0, cv)))
  }
  const cs = km?.confidence_score
  if (typeof cs === 'number' && Number.isFinite(cs)) {
    return Math.round(Math.min(100, Math.max(0, cs)))
  }
  return null
}

export type PmActionPlanSectionProps = {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: AnalysisTask[] | null
  consensusData?: {
    strategicSummary?: { opportunity?: string; summary?: string }
  } | null
  loading?: boolean
  keyword?: string
  onRetryExecutionLayer?: () => void
}

/**
 * PM 액션 플랜: 실행 준비도 → 우선순위·예상 성과 2열 → 리스크·기회 평가 → 실행 테이블
 */
export function PmActionPlanSection({
  result,
  taskData = {},
  analysisTasks = null,
  loading = false,
  keyword = '',
  onRetryExecutionLayer,
}: PmActionPlanSectionProps) {
  const km = result?.key_metrics ?? {}

  const strategicRisksLines = useMemo(() => {
    const neg = [...(km.negative_risks ?? [])].filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    const rs = (km.risk_signals ?? [])
      .filter((r) => !!r && typeof r.risk === 'string')
      .map((r) => `${r.risk} (심각도 ${r.severity}/10)`)
    return [...neg, ...rs].slice(0, 12)
  }, [km])

  const priorityItems = useMemo(() => {
    const raw = extractNextActionItems(result, taskData, analysisTasks, { maxItems: 12 })
    return raw
      .filter((a) => a.action?.trim())
      .map((a) => ({
        priority: urgencyToPriorityLevel(a.priority),
        title: a.action!.trim(),
        description:
          (a.how_to_execute ?? '').trim() ||
          (a.why ?? '').trim() ||
          '상세는 실행 단계(pm_action_plan) 출력을 참고하세요.',
        timeline: normalizeActionTimeline(a.estimated_effort),
        impact:
          (a.why ?? '').trim() ||
          ((a.how_to_execute ?? '').trim() ? '실행 중심 과제' : '임팩트: 미기재'),
      }))
      .sort((a, b) => a.priority - b.priority)
  }, [result, taskData, analysisTasks])

  const outcomeMetrics = useMemo(
    () => buildOutcomeMetricItems(result, taskData, analysisTasks),
    [result, taskData, analysisTasks]
  )

  const executionBusy = isExecutionLayerBusy(analysisTasks)
  const executionComplete = isExecutionLayerComplete(analysisTasks, result)
  const executionFailed = isExecutionLayerFailed(analysisTasks)

  const { priorityBlock, outcomesBlock } = useMemo(() => {
    const hasP = priorityItems.length > 0
    const hasO = outcomeMetrics.length > 0
    const choose = (has: boolean): 'data' | 'loading' | 'missing' => {
      if (has) return 'data'
      if (executionBusy) return 'loading'
      if (executionComplete || executionFailed) return 'missing'
      if ((analysisTasks?.length ?? 0) > 0) return 'loading'
      if (result?.reportId) return 'missing'
      return 'loading'
    }
    return {
      priorityBlock: choose(hasP),
      outcomesBlock: choose(hasO),
    }
  }, [
    priorityItems.length,
    outcomeMetrics.length,
    executionBusy,
    executionComplete,
    executionFailed,
    analysisTasks?.length,
    result?.reportId,
  ])

  const exportRows = useMemo(
    () => extractNextActionItems(result, taskData, analysisTasks, { maxItems: 24 }),
    [result, taskData, analysisTasks]
  )

  const { readiness, p0, p1, total } = useMemo(() => {
    const rows = exportRows
    const p0 = rows.filter((r) => r.priority === 'high').length
    const p1 = rows.filter((r) => r.priority === 'medium').length
    if (rows.length === 0) return { readiness: 0, p0: 0, p1: 0, total: 0 }
    const score = Math.min(100, Math.max(30, 28 + p0 * 22 + p1 * 14 + Math.min(8, rows.length) * 2))
    return { readiness: score, p0, p1, total: rows.length }
  }, [exportRows])

  const confidencePct = confidencePercentFromResult(result)

  const hasStrategicRisks = strategicRisksLines.some((s) => s.trim().length > 0)

  return (
    <div className="space-y-6 font-sans">
      <PmExecutionReadinessHeader
        readinessScore={readiness}
        p0Count={p0}
        p1Count={p1}
        confidencePercent={confidencePct}
        totalActions={total}
        keyword={keyword}
        exportDisabled={exportRows.length === 0}
        rowsForCsv={exportRows}
      />

      <div className="grid grid-cols-1 items-stretch gap-6 px-2 sm:px-3 lg:grid-cols-2 lg:gap-8">
        <PrioritySuggestionsCard
          items={priorityItems}
          block={priorityBlock}
          onRetry={onRetryExecutionLayer}
        />
        <ExpectedOutcomesCard
          outcomes={outcomeMetrics}
          block={outcomesBlock}
          onRetry={onRetryExecutionLayer}
        />
      </div>

      <div className="rin-card overflow-hidden">
        <div className="px-5 pb-0 pt-5 sm:px-6">
          <SectionHeader icon={AlertTriangle} title="리스크·기회 평가" subtitle="정량·정성 교차검증과 리스크 시그널을 함께 봅니다." />
        </div>
        <div className="space-y-5 px-5 pb-5 pt-2 sm:px-6">
          {hasStrategicRisks ? (
            <div className="rounded-xl border border-border/60 bg-muted/10 p-4">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">전략적 리스크</p>
              <ul className="space-y-2 text-sm text-foreground">
                {strategicRisksLines.filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2 leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/90" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <MarkdownBody className="!prose-sm max-w-none leading-relaxed">{line}</MarkdownBody>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">키 메트릭에 전략적 리스크 문구가 없습니다. 아래 평가 블록을 참고하세요.</p>
          )}
          <StrategyEvaluationSection result={result} loading={loading} embedded showEmbeddedHeading={false} />
        </div>
      </div>

      <StrategyExecutionTable
        result={result}
        taskData={taskData}
        analysisTasks={analysisTasks}
        loading={loading}
        keyword={keyword}
        variant="consulting"
      />
    </div>
  )
}
