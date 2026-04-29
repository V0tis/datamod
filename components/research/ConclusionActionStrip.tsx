'use client'

import { ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { threeLinesFromStrategyTaskOutput } from '@/lib/stores/research-store'
import { stripLeadingMarkdownHeadings } from '@/lib/strip-markdown-heading-markers'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'

function cleanActionLine(s: string): string {
  return stripLeadingMarkdownHeadings(s)
    .replace(/^[-*•\d.)\s]+/, '')
    .trim()
}

const PILLAR_LABELS = ['현상', '기회', '실행'] as const

export type ConclusionActionStripTaskRow = {
  step_name: string
  output_data?: unknown
}

function getStrategyTaskOutput(
  taskData?: Partial<Record<string, unknown>>,
  analysisTasks?: ConclusionActionStripTaskRow[] | null
): Record<string, unknown> | null {
  const fromTask = taskData?.strategy_generation
  const fromRow = analysisTasks?.find((t) => t.step_name === 'strategy_generation')?.output_data
  const raw = fromTask ?? fromRow
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null
}

function takePmActionTitles(result: ResearchResponse | null): string[] {
  const actions = result?.key_metrics?.pm_actions?.recommended_actions ?? []
  return actions
    .map((a) => cleanActionLine(a?.title ?? (a as { action?: string }).action ?? ''))
    .filter(Boolean)
}

function takePmActionTitlesFromTasks(
  result: ResearchResponse | null,
  taskData?: Partial<Record<string, unknown>>,
  analysisTasks?: ConclusionActionStripTaskRow[] | null
): string[] {
  const fromKm = takePmActionTitles(result)
  if (fromKm.length > 0) return fromKm
  return extractNextActionItems(
    result,
    taskData,
    analysisTasks as Parameters<typeof extractNextActionItems>[2],
    { maxItems: 8 }
  )
    .map((a) => cleanActionLine(a.action))
    .filter(Boolean)
}

function takeKeyStrategicLines(result: ResearchResponse | null): string[] {
  const raw = result?.key_metrics?.key_strategic_insights
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => cleanActionLine(s))
    .filter(Boolean)
    .slice(0, 3)
}

function takeKeyStrategicFromStrategy(strat: Record<string, unknown> | null): string[] {
  if (!strat) return []
  const raw = strat.key_strategic_insights
  const fromInsights = Array.isArray(raw)
    ? raw.filter((s): s is string => typeof s === 'string').map((s) => cleanActionLine(s)).filter(Boolean)
    : []
  if (fromInsights.length > 0) return fromInsights.slice(0, 3)
  const opps = strat.opportunities
  if (Array.isArray(opps)) {
    return opps
      .filter((s): s is string => typeof s === 'string')
      .map((s) => cleanActionLine(s))
      .filter(Boolean)
      .slice(0, 3)
  }
  return []
}

function takeMarketSummaryLine(result: ResearchResponse | null, strat: Record<string, unknown> | null): string | null {
  const fromKm = result?.key_metrics?.market_summary
  if (typeof fromKm === 'string') {
    const t = cleanActionLine(fromKm)
    if (t.length > 8) return t
  }
  const fromStrat = strat?.market_summary
  if (typeof fromStrat === 'string') {
    const t = cleanActionLine(fromStrat)
    if (t.length > 8) return t
  }
  return null
}

function takeAnalysisResultsLines(result: ResearchResponse | null): string[] {
  const ar = result?.analysis_results
  if (!ar || typeof ar !== 'object') return []
  const out: string[] = []
  const si = (ar as { strategic_insight?: string }).strategic_insight
  const ai = (ar as { action_item?: string }).action_item
  if (typeof si === 'string' && si.trim().length > 8) out.push(cleanActionLine(si))
  if (typeof ai === 'string' && ai.trim().length > 8) out.push(cleanActionLine(ai))
  return out
}

function takeKeyConclusionLines(result: ResearchResponse | null): string[] {
  const km = result?.key_metrics?.keyConclusions
  const top = result?.keyConclusions
  const raw = Array.isArray(km) && km.length > 0 ? km : Array.isArray(top) ? top : []
  return raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => cleanActionLine(s))
    .filter(Boolean)
    .slice(0, 3)
}

/** conclusion_three_lines + 전략 태스크 출력 + PM 액션·인사이트로 3줄 구성 */
export function takeThreeActionLines(
  result: ResearchResponse | null,
  taskData?: Partial<Record<string, unknown>>,
  analysisTasks?: ConclusionActionStripTaskRow[] | null
): { lines: string[]; labels: readonly string[] } {
  const strat = getStrategyTaskOutput(taskData, analysisTasks)
  const km = result?.key_metrics

  const fromThreeLinesField = Array.isArray(km?.conclusion_three_lines)
    ? km!.conclusion_three_lines!
        .map((s) => cleanActionLine(typeof s === 'string' ? s : ''))
        .filter(Boolean)
        .slice(0, 3)
    : []

  const fromStrategyTask = threeLinesFromStrategyTaskOutput(strat) ?? []

  const fromModel =
    fromThreeLinesField.length > 0 ? fromThreeLinesField : fromStrategyTask.length > 0 ? fromStrategyTask : []

  if (fromModel.length === 3) {
    return { lines: fromModel, labels: PILLAR_LABELS }
  }

  const merged: string[] = [...fromModel]
  const pmTitles = takePmActionTitlesFromTasks(result, taskData, analysisTasks)
  const insights = [...takeKeyStrategicLines(result), ...takeKeyStrategicFromStrategy(strat)]
  const marketLine = takeMarketSummaryLine(result, strat)
  const arLines = takeAnalysisResultsLines(result)
  const kcLines = takeKeyConclusionLines(result)

  for (const t of pmTitles) {
    if (merged.length >= 3) break
    if (t && !merged.includes(t)) merged.push(t)
  }
  for (const t of insights) {
    if (merged.length >= 3) break
    if (t && !merged.includes(t)) merged.push(t)
  }
  for (const t of arLines) {
    if (merged.length >= 3) break
    if (t && !merged.includes(t)) merged.push(t)
  }
  for (const t of kcLines) {
    if (merged.length >= 3) break
    if (t && !merged.includes(t)) merged.push(t)
  }
  if (merged.length < 3 && marketLine && !merged.includes(marketLine)) {
    merged.push(marketLine)
  }

  return { lines: merged.slice(0, 3), labels: PILLAR_LABELS }
}

export function ConclusionActionStrip({
  result,
  taskData,
  analysisTasks,
  className,
}: {
  result: ResearchResponse | null
  /** 파이프라인 태스크 출력 — DB key_metrics에 3줄이 없을 때 strategy_generation 등에서 복원 */
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: ConclusionActionStripTaskRow[] | null
  className?: string
}) {
  const { lines, labels } = takeThreeActionLines(result, taskData, analysisTasks)

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-slate-100 bg-gradient-to-br from-sky-50/80 to-white px-4 py-4    sm:px-5',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-800 ">
        <ListTodo className="h-4 w-4 shrink-0" aria-hidden />
        3줄 요약 액션
      </div>
      <p className="mb-3 text-xs leading-relaxed tracking-wide text-slate-500 ">
        현상(경쟁·문제) → 기회(니치) → 실행(최우선 과제) 순. 전략 단계 산출값이 있으면 즉시 반영됩니다.
      </p>
      {lines.length === 0 ? (
        <p className="text-sm leading-relaxed tracking-wide text-slate-600 ">
          전략·실행 단계 산출 또는 요약 필드가 없어 3줄을 구성할 수 없습니다. 재분석 후에도 비면 모델 응답 형식을 확인해 주세요.
        </p>
      ) : (
        <ol className="m-0 list-none space-y-3 p-0 text-sm leading-[1.65] tracking-wide text-pretty text-slate-700  [word-break:keep-all]">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-sky-700/90 ">
                {labels[i] ?? PILLAR_LABELS[Math.min(i, 2)]}
              </span>
              <span className="min-w-0 flex-1">{line}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
