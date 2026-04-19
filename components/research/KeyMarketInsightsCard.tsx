'use client'

import { StructuredInsightCard, type StructuredInsight } from '@/components/research/StructuredInsightCard'
import { InsightsRichBlocks } from '@/components/research/insights-rich-blocks'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'
import {
  buildOutcomeMetricItems,
  isExecutionLayerBusy,
  isExecutionLayerComplete,
  isExecutionLayerFailed,
  urgencyToPriorityLevel,
} from '@/lib/research-priority-outcomes'
import { useEffect, useMemo, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { breakdownDimensionTo10 } from '@/lib/score-display'
import type { ResearchResponse } from '@/lib/stores/research-store'

type CoreInsightItem = {
  title?: string
  summary?: string
  impact?: string
  reason?: string
  score?: number
  source_timestamp?: string
}

/** Extract key metrics (numbers, scores) from text */
function extractKeyMetrics(text: string): string[] {
  const metrics: string[] = []
  const m1 = text.match(/\d+\s*\/\s*100/g)
  const m2 = text.match(/\d+%/g)
  const m3 = text.match(/\d+점/g)
  if (m1) metrics.push(...m1)
  if (m2) metrics.push(...m2)
  if (m3) metrics.push(...m3)
  return [...new Set(metrics)].slice(0, 4)
}

function scoreToPriority(score?: number): 'high' | 'mid' | 'low' | undefined {
  if (score == null || !Number.isFinite(score)) return undefined
  if (score >= 7) return 'high'
  if (score >= 4) return 'mid'
  return 'low'
}

/** Map pipeline core_insights to StructuredInsight (no placeholder 영향/근거) */
function coreInsightToStructured(item: CoreInsightItem, fallbackAsOf?: string): StructuredInsight {
  const title = (item.title ?? '').trim() || (item.summary ?? '').trim().slice(0, 15) + '…'
  const summary = (item.summary ?? '').trim() || '분석 인사이트'
  const impact = (item.impact ?? '').trim()
  const reason = (item.reason ?? '').trim()
  const priority = scoreToPriority(item.score)
  const sourceTimestamp = (item.source_timestamp ?? fallbackAsOf)?.trim()
  const metricText = [summary, impact, reason].filter(Boolean).join(' ')
  const km = extractKeyMetrics(metricText)
  return {
    title,
    summary,
    ...(impact ? { impact } : {}),
    ...(reason ? { reason } : {}),
    ...(priority ? { priority } : {}),
    ...(sourceTimestamp ? { sourceTimestamp } : {}),
    ...(km.length > 0 ? { keyMetrics: km } : {}),
  }
}

/** Derive structured insight from a raw insight string (fallback when no core_insights) */
function toStructuredInsight(text: string, fallbackAsOf?: string): StructuredInsight {
  const t = text.trim()
  if (!t) {
    return {
      title: '분석 요약',
      summary: '데이터 수집 완료. 상세 인사이트는 재분석 후 확인할 수 있습니다.',
      impact: '추가 분석이 필요합니다.',
      reason: '트렌드·경쟁 데이터를 반영한 요약입니다.',
      ...(fallbackAsOf?.trim() ? { sourceTimestamp: fallbackAsOf.trim() } : {}),
    }
  }

  let title = ''
  let summary = t

  const colon = t.match(/^([^:]+):\s*([\s\S]+)$/)
  if (colon) {
    title = colon[1].trim().slice(0, 60)
    summary = colon[2].trim()
  } else {
    const dash = t.match(/^([^–—-]+)[–—-]\s*([\s\S]+)$/)
    if (dash) {
      title = dash[1].trim().slice(0, 60)
      summary = dash[2].trim()
    } else {
      const dot = t.indexOf('. ')
      if (dot > 10 && dot < t.length - 2) {
        const after = t.slice(dot + 2).trim()
        if (after) {
          title = t.slice(0, dot).trim()
          summary = after
        }
      }
      if (!title) {
        if (t.length <= 40) {
          title = t.length > 20 ? t.slice(0, 20).trim() + '…' : (t.length > 10 ? t.slice(0, 10).trim() + '…' : t)
          summary = t
          if (title === summary && t.length > 0) title = t.slice(0, Math.min(15, t.length - 1)).trim() + '…'
        } else {
          const firstPhrase = t.slice(0, 45).trim()
          const rest = t.slice(45).trim()
          title = rest ? firstPhrase + (firstPhrase.endsWith('.') ? '' : '…') : t.slice(0, 40).trim() + '…'
          summary = rest || t
        }
      }
    }
  }

  const keyMetrics = extractKeyMetrics(text)
  const impact = '시장·제품 전략 수립에 참고할 수 있는 인사이트입니다.'
  const reason = '트렌드 및 경쟁 분석 결과를 바탕으로 도출되었습니다.'

  return {
    title,
    summary,
    impact,
    reason,
    ...(fallbackAsOf?.trim() ? { sourceTimestamp: fallbackAsOf.trim() } : {}),
    keyMetrics: keyMetrics.length > 0 ? keyMetrics : undefined,
  }
}

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
  const strategyOutput = getTaskOutput('strategy_generation', taskData, analysisTasks)

  const newsActivity = Array.isArray(signalOutput?.news_activity)
    ? (signalOutput.news_activity as Array<{ title?: string; publisher?: string }>)
    : []
  const signalHeadlines = newsActivity.map((n) => (n.title ?? '').trim().slice(0, 60)).filter(Boolean).slice(0, 4)
  const fallbackNews = newsList.slice(0, 4).map((n) => (n.title ?? '').trim().slice(0, 60)).filter(Boolean)
  const earlySignals = signalHeadlines.length > 0 ? signalHeadlines : fallbackNews

  const opportunityScore = typeof km.opportunity_score === 'number' ? km.opportunity_score : null
  const breakdown = km.opportunity_score_breakdown ?? {}
  const marketGrowth = typeof breakdown.market_growth === 'number' ? breakdown.market_growth : null
  const trendMomentum = typeof breakdown.trend_momentum === 'number' ? breakdown.trend_momentum : null
  const growthSignals = Array.isArray(trendOutput?.growth_signals)
    ? (trendOutput.growth_signals as string[]).filter((s) => typeof s === 'string').slice(0, 3)
    : []
  const keyTrends = [...growthSignals, ...(km.positive_signals ?? []).slice(0, 2)].filter(Boolean).slice(0, 3)

  const opportunities = Array.isArray(strategyOutput?.opportunities)
    ? (strategyOutput.opportunities as string[]).filter((s) => typeof s === 'string').slice(0, 3)
    : (Array.isArray(km.positive_signals) ? km.positive_signals : Array.isArray(result?.marketNews) ? result.marketNews : []).slice(0, 3)
  const valueProposition = (consensusData?.strategicSummary?.opportunity ?? '').trim()
  const summaryInsights = (km.summary_insights ?? '').trim()
  const trendSummary = typeof trendOutput?.trend_summary === 'string' ? trendOutput.trend_summary : ''

  const growthDim =
    marketGrowth != null || trendMomentum != null
      ? breakdownDimensionTo10((marketGrowth ?? trendMomentum) as number)
      : null
  const growthPotential =
    opportunityScore != null
      ? `시장 매력도 ${opportunityScore.toLocaleString('ko-KR')}/100점`
      : growthDim != null
        ? `성장 잠재력 ${growthDim}/10`
        : trendSummary?.slice(0, 80) || summaryInsights?.slice(0, 80) || '-'

  const marketTrends =
    keyTrends.length > 0
      ? keyTrends.join(' · ')
      : earlySignals.length > 0
        ? earlySignals.slice(0, 2).join(' · ')
        : (km.positive_signals ?? [])[0] || '-'

  const keyOpportunities =
    valueProposition || opportunities[0] || (km.positive_signals ?? [])[0] || earlySignals[0] || '-'

  const hasEarlyData = signalOutput != null || trendOutput != null || earlySignals.length > 0 || result != null

  const hasContent = result || (analysisTasks?.length ?? 0) > 0

  const trendBullets = marketTrends && marketTrends !== '-'
    ? marketTrends.split(/\s*·\s*/).filter((s) => s.trim().length > 3).map((s) => s.trim())
    : []
  const bulletInsights: string[] = hasEarlyData
    ? [
        ...(growthPotential && growthPotential !== '-' ? [growthPotential] : []),
        ...trendBullets,
        ...(keyOpportunities && keyOpportunities !== '-' && !trendBullets.includes(keyOpportunities) ? [keyOpportunities] : []),
        ...(growthSignals?.filter((s) => s && s.length > 5) ?? []),
        ...(Array.isArray(km.positive_signals) ? km.positive_signals.filter((s): s is string => typeof s === 'string' && s.length > 5).slice(0, 3) : []),
        ...(Array.isArray(opportunities) ? opportunities.filter((s) => s && s.length > 5).slice(0, 2) : []),
      ].filter((v, i, arr) => v && arr.indexOf(v) === i).slice(0, 8)
    : []

  const useStreaming = loading && hasEarlyData
  const skipAnimation = !loading && hasEarlyData
  const showStreamingComplete = !loading && hasEarlyData

  // Prefer pipeline core_insights (title/summary/impact/reason) when available
  const coreInsightsRaw = (km.core_insights ?? getTaskOutput('insight_extraction', taskData, analysisTasks)?.core_insights) as CoreInsightItem[] | undefined
  const reportAsOf = result?.updated_at?.trim()
  const coreInsightsList = Array.isArray(coreInsightsRaw) && coreInsightsRaw.length > 0
    ? coreInsightsRaw
        .filter((i): i is CoreInsightItem => {
          if (!i || typeof i !== 'object') return false
          const s = (i as CoreInsightItem).summary
          return typeof s === 'string' && s.trim().length > 0
        })
        .slice(0, 8)
        .map((i) => coreInsightToStructured(i, reportAsOf))
    : []

  const structuredInsights =
    coreInsightsList.length > 0 ? coreInsightsList : bulletInsights.map((t) => toStructuredInsight(t, reportAsOf))

  const [revealedCount, setRevealedCount] = useState(0)
  const prevKey = useRef('')
  const key = structuredInsights.length > 0 ? structuredInsights.map((s) => s.summary).join('|') : bulletInsights.join('|')

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
        timeline: (a.estimated_effort ?? '').trim() || '예상 기간: 미기재',
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
          <div>
            {structuredInsights.slice(0, revealedCount).map((insight, i) => (
              <StructuredInsightCard
                key={i}
                insight={insight}
                variant="list"
                className="animate-in fade-in slide-in-from-bottom-2 duration-200"
              />
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
