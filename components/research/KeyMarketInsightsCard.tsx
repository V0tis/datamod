'use client'

import { StructuredInsightCard } from '@/components/research/StructuredInsightCard'
import { InsightsRichBlocks } from '@/components/research/insights-rich-blocks'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'
import {
  buildOutcomeMetricItems,
  isExecutionLayerBusy,
  isExecutionLayerComplete,
  isExecutionLayerFailed,
  normalizeActionTimeline,
  urgencyToPriorityLevel,
} from '@/lib/research-priority-outcomes'
import { buildStructuredInsightsList } from '@/lib/build-structured-insights-list'
import { useEffect, useMemo, useState, useRef } from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'

type TaskOutput = Record<string, unknown>
type AnalysisTask = {
  step_name: string
  status: string
  output_data: unknown
}

function getTaskOutput(
  step: string,
  taskData: Partial<Record<string, unknown>>,
  analysisTasks: AnalysisTask[] | null | undefined
): TaskOutput | null {
  const task = analysisTasks?.find((t) => t.step_name === step)
  const raw = (task?.output_data && typeof task.output_data === 'object'
    ? task.output_data
    : taskData[step]) as TaskOutput | null
  return raw && typeof raw === 'object' ? raw : null
}

export interface KeyMarketInsightsCardProps {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: AnalysisTask[] | null
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  consensusData?: {
    strategicSummary?: { opportunity?: string; summary?: string }
  } | null
  loading?: boolean
  keyword?: string
  /** `execution_layer` 단계만 재실행 — 우선순위·예상 성과 데이터 누락 시 버튼에 연결 */
  onRetryExecutionLayer?: () => void
  /** full: 인사이트 카드 + 하단 블록 / footer-only: 우선순위·예상 성과·리스크 블록만 */
  variant?: 'full' | 'footer-only'
  /** variant가 full일 때 하단(우선순위·성과·리스크) 표시 여부 */
  withFooterBlocks?: boolean
}

/**
 * 핵심 시장 인사이트 - 3초 내 주요 결론 파악용 요약 카드
 * • 시장 성장 가능성
 * • 주요 시장 트렌드
 * • 핵심 기회 영역
 */
export function KeyMarketInsightsCard({
  result,
  taskData = {},
  analysisTasks = null,
  newsList = [],
  consensusData,
  loading = false,
  keyword = '',
  onRetryExecutionLayer,
  variant = 'full',
  withFooterBlocks = true,
}: KeyMarketInsightsCardProps) {
  const km = result?.key_metrics ?? {}
  const signalOutput = getTaskOutput('signal_layer', taskData, analysisTasks)
  const trendOutput = getTaskOutput('trend_analysis', taskData, analysisTasks)

  const newsActivity = Array.isArray(signalOutput?.news_activity)
    ? (signalOutput.news_activity as Array<{ title?: string; publisher?: string }>)
    : []
  const signalHeadlines = newsActivity.map((n) => (n.title ?? '').trim().slice(0, 60)).filter(Boolean).slice(0, 4)
  const fallbackNews = newsList.slice(0, 4).map((n) => (n.title ?? '').trim().slice(0, 60)).filter(Boolean)
  const earlySignals = signalHeadlines.length > 0 ? signalHeadlines : fallbackNews

  const hasEarlyData = signalOutput != null || trendOutput != null || earlySignals.length > 0 || result != null

  const hasContent = result || (analysisTasks?.length ?? 0) > 0

  const useStreaming = loading && hasEarlyData
  const skipAnimation = !loading && hasEarlyData
  const showStreamingComplete = !loading && hasEarlyData

  const structuredInsights = useMemo(
    () =>
      buildStructuredInsightsList({
        result,
        taskData,
        analysisTasks,
        consensusData,
        newsList,
      }),
    [result, taskData, analysisTasks, consensusData, newsList]
  )

  const [revealedCount, setRevealedCount] = useState(0)
  const prevKey = useRef('')
  const key = structuredInsights.map((s) => s.summary).join('|')

  useEffect(() => {
    if (structuredInsights.length === 0) {
      setRevealedCount(0)
      return
    }
    if (key !== prevKey.current) {
      prevKey.current = key
      setRevealedCount(0)
    }
  }, [key, structuredInsights.length])

  useEffect(() => {
    if (skipAnimation || !useStreaming || structuredInsights.length === 0) {
      setRevealedCount(structuredInsights.length)
      return
    }
    if (revealedCount >= structuredInsights.length) return
    const t = setTimeout(() => setRevealedCount((c) => Math.min(c + 1, structuredInsights.length)), 320)
    return () => clearTimeout(t)
  }, [revealedCount, structuredInsights.length, useStreaming, skipAnimation])

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
        title: a.action.trim(),
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

  const devEmptyInsightWarnedRef = useRef<string | null>(null)
  useEffect(() => {
    devEmptyInsightWarnedRef.current = null
  }, [result?.reportId])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    if (!executionComplete && !executionFailed) return
    if (!result?.reportId) return
    if (priorityItems.length > 0 && outcomeMetrics.length > 0) return
    const dedupeKey = `${result.reportId}:${priorityItems.length}:${outcomeMetrics.length}`
    if (devEmptyInsightWarnedRef.current === dedupeKey) return
    devEmptyInsightWarnedRef.current = dedupeKey
    const execOut = getTaskOutput('execution_layer', taskData, analysisTasks)
    const kmm = result.key_metrics
    const recLen = kmm?.pm_actions?.recommended_actions?.length ?? 0
    const planLen = Array.isArray((kmm as { pm_action_plan?: unknown[] } | undefined)?.pm_action_plan)
      ? (((kmm as { pm_action_plan: unknown[] }).pm_action_plan?.length ?? 0) as number)
      : 0
    const insightLen = Array.isArray(kmm?.key_strategic_insights) ? kmm.key_strategic_insights.length : 0
    console.warn(
      '[KeyMarketInsights] execution_layer 완료(또는 실패) 후에도 우선순위·예상 성과 바인딩이 비어 있습니다. task output·key_metrics 필드를 확인하세요.',
      {
        reportId: result.reportId,
        priorityCount: priorityItems.length,
        outcomesCount: outcomeMetrics.length,
        key_metrics_pm_actions_recommended: recLen,
        key_metrics_pm_action_plan: planLen,
        key_metrics_key_strategic_insights: insightLen,
        execution_layer_output_keys: execOut ? Object.keys(execOut) : null,
      }
    )
  }, [
    executionComplete,
    executionFailed,
    result,
    priorityItems.length,
    outcomeMetrics.length,
    taskData,
    analysisTasks,
  ])

  if (!hasContent && !loading) return null

  const isFooterOnly = variant === 'footer-only'

  if (isFooterOnly) {
    return (
      <div className="space-y-0">
        {loading && !hasEarlyData ? (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-10 rounded-md bg-muted/50" />
            <div className="h-10 rounded-md bg-muted/40" />
          </div>
        ) : (
          <InsightsRichBlocks
            strategicRisks={strategicRisksLines}
            priorityItems={priorityItems}
            outcomeMetrics={outcomeMetrics}
            priorityBlock={priorityBlock}
            outcomesBlock={outcomesBlock}
            onRetrySection={onRetryExecutionLayer}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {showStreamingComplete && (
        <div className="mb-6 inline-flex items-center rounded-md border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
          분석 완료
        </div>
      )}
      {loading && !hasEarlyData ? (
        <div className="space-y-0 divide-y divide-border/50">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="py-6 animate-pulse">
              <div className="h-4 w-2/5 rounded bg-muted/50 mb-3" />
              <div className="h-3 w-full rounded bg-muted/30 mb-2" />
              <div className="h-3 w-4/5 rounded bg-muted/25" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="columns-1 [column-gap:1rem] sm:columns-2">
            {structuredInsights.slice(0, revealedCount).map((insight, i) => (
              <div key={i} className="mb-4 break-inside-avoid animate-in fade-in slide-in-from-bottom-2 duration-200">
                <StructuredInsightCard insight={insight} variant="masonry" />
              </div>
            ))}
          </div>
          {withFooterBlocks ? (
            <InsightsRichBlocks
              strategicRisks={strategicRisksLines}
              priorityItems={priorityItems}
              outcomeMetrics={outcomeMetrics}
              priorityBlock={priorityBlock}
              outcomesBlock={outcomesBlock}
              onRetrySection={onRetryExecutionLayer}
              className="mt-2"
            />
          ) : null}
        </>
      )}
    </div>
  )
}
