'use client'

import { StructuredInsightCard, type StructuredInsight } from '@/components/research/StructuredInsightCard'
import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'

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

/** Derive structured insight from a raw insight string */
function toStructuredInsight(text: string): StructuredInsight {
  const t = text.trim()
  if (!t) return { title: '—', summary: '—' }

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
          title = t
          summary = t
        } else {
          const firstPhrase = t.slice(0, 45).trim()
          const rest = t.slice(45).trim()
          title = rest ? firstPhrase + (firstPhrase.endsWith('.') ? '' : '…') : t
          summary = rest || t
        }
      }
    }
  }

  const keyMetrics = extractKeyMetrics(text)

  return { title, summary, keyMetrics: keyMetrics.length > 0 ? keyMetrics : undefined }
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
    : (km.positive_signals ?? result?.marketNews ?? []).slice(0, 3)
  const valueProposition = (consensusData?.strategicSummary?.opportunity ?? '').trim()
  const summaryInsights = (km.summary_insights ?? '').trim()
  const trendSummary = typeof trendOutput?.trend_summary === 'string' ? trendOutput.trend_summary : ''

  const growthPotential =
    opportunityScore != null
      ? `시장 매력도 ${opportunityScore}/100점`
      : marketGrowth != null || trendMomentum != null
        ? `성장 잠재력 ${(marketGrowth ?? trendMomentum) ?? ''}/100`
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

  const structuredInsights = bulletInsights.map(toStructuredInsight)

  const [revealedCount, setRevealedCount] = useState(0)
  const prevKey = useRef('')
  const key = bulletInsights.join('|')

  useEffect(() => {
    if (bulletInsights.length === 0) {
      setRevealedCount(0)
      return
    }
    if (key !== prevKey.current) {
      prevKey.current = key
      setRevealedCount(0)
    }
  }, [key, bulletInsights.length])

  useEffect(() => {
    if (skipAnimation || !useStreaming || bulletInsights.length === 0) {
      setRevealedCount(bulletInsights.length)
      return
    }
    if (revealedCount >= bulletInsights.length) return
    const t = setTimeout(() => setRevealedCount((c) => Math.min(c + 1, bulletInsights.length)), 320)
    return () => clearTimeout(t)
  }, [revealedCount, bulletInsights.length, useStreaming, skipAnimation])

  const showCursor = useStreaming && revealedCount > 0 && revealedCount < bulletInsights.length

  if (!hasContent && !loading) return null

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 sm:p-5">
      {showStreamingComplete && (
        <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">분석 완료</p>
      )}
      {loading && !hasEarlyData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card/50 p-4 h-24 animate-pulse">
              <div className="h-4 w-3/4 rounded bg-muted/50 mb-2" />
              <div className="h-3 w-full rounded bg-muted/30" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {structuredInsights.slice(0, revealedCount).map((insight, i) => (
            <StructuredInsightCard
              key={i}
              insight={insight}
              className="animate-in fade-in slide-in-from-bottom-2 duration-200"
            />
          ))}
          {showCursor && (
            <div
              className={cn(
                'rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 flex items-center gap-2 text-xs text-muted-foreground',
                'animate-in fade-in duration-200'
              )}
            >
              <span className="inline-block w-0.5 h-4 bg-primary animate-pulse" aria-hidden />
              AI 인사이트 생성중…
            </div>
          )}
        </div>
      )}
    </div>
  )
}
