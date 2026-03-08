'use client'

import { useState, useCallback } from 'react'
import { Lightbulb } from 'lucide-react'
import { ProductStrategySection } from '@/components/research/ProductStrategySection'
import { StreamingInsightText } from '@/components/research/StreamingInsightText'
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
        : trendSummary?.slice(0, 80) || summaryInsights?.slice(0, 80) || '분석 중'

  const marketTrends =
    keyTrends.length > 0
      ? keyTrends.join(' · ')
      : earlySignals.length > 0
        ? earlySignals.slice(0, 2).join(' · ')
        : (km.positive_signals ?? [])[0] || '트렌드 분석 중'

  const keyOpportunities =
    valueProposition || opportunities[0] || (km.positive_signals ?? [])[0] || earlySignals[0] || '기회 영역 분석 중'

  const hasEarlyData = signalOutput != null || trendOutput != null || earlySignals.length > 0 || result != null

  const hasContent = result || (analysisTasks?.length ?? 0) > 0

  const [streamComplete, setStreamComplete] = useState(false)
  const handleStreamComplete = useCallback(() => setStreamComplete(true), [])

  const insightItems: Array<{ label: string; value: string }> = hasEarlyData
    ? [
        { label: '핵심 시장 키워드', value: growthPotential },
        { label: '초기 트렌드 방향', value: marketTrends },
        { label: '시장 기회 신호', value: keyOpportunities },
      ]
    : []

  const useStreaming = loading && hasEarlyData
  const skipAnimation = !loading && hasEarlyData
  const showStreamingComplete = !loading && hasEarlyData

  if (!hasContent && !loading) return null

  return (
    <ProductStrategySection
      title="핵심 시장 인사이트"
      icon={<Lightbulb className="h-5 w-5 text-primary" />}
      className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
      streamingComplete={showStreamingComplete}
    >
      <p className="text-xs text-muted-foreground mb-4">
        분석 결과의 핵심 결론을 한눈에 파악할 수 있습니다.
      </p>
      {loading && !hasEarlyData ? (
        <ul className="space-y-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-medium shrink-0">•</span>
              <div className="h-5 w-3/4 rounded bg-muted/50 animate-pulse" />
            </li>
          ))}
        </ul>
      ) : (
        <StreamingInsightText
          items={insightItems}
          streaming={useStreaming}
          skipAnimation={skipAnimation}
          onComplete={handleStreamComplete}
          revealDelayMs={380}
        />
      )}
    </ProductStrategySection>
  )
}
