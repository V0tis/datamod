'use client'

import { Lightbulb } from 'lucide-react'
import { ProductStrategySection } from '@/components/research/ProductStrategySection'
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
  consensusData?: {
    strategicSummary?: { opportunity?: string; summary?: string }
  } | null
  loading?: boolean
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
  consensusData,
  loading = false,
}: KeyMarketInsightsCardProps) {
  const km = result?.key_metrics ?? {}
  const trendOutput = getTaskOutput('trend_analysis', taskData, analysisTasks)
  const strategyOutput = getTaskOutput('strategy_generation', taskData, analysisTasks)

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

  const growthPotential =
    opportunityScore != null
      ? `시장 매력도 ${opportunityScore}/100점`
      : marketGrowth != null || trendMomentum != null
        ? `성장 잠재력 ${(marketGrowth ?? trendMomentum) ?? ''}/100`
        : summaryInsights?.slice(0, 80) || '분석 중'

  const marketTrends =
    keyTrends.length > 0
      ? keyTrends.join(' · ')
      : (km.positive_signals ?? [])[0] || '트렌드 분석 중'

  const keyOpportunities =
    valueProposition || opportunities[0] || (km.positive_signals ?? [])[0] || '기회 영역 분석 중'

  const hasContent = result || (analysisTasks?.length ?? 0) > 0

  if (!hasContent && !loading) return null

  return (
    <ProductStrategySection
      title="핵심 시장 인사이트"
      icon={<Lightbulb className="h-5 w-5 text-primary" />}
      className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
    >
      <p className="text-xs text-muted-foreground mb-4">
        분석 결과의 핵심 결론을 한눈에 파악할 수 있습니다.
      </p>
      {loading && !result ? (
        <ul className="space-y-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="flex gap-3">
              <span className="text-primary font-medium shrink-0">•</span>
              <div className="h-5 w-3/4 rounded bg-muted/50 animate-pulse" />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-3">
          <li className="flex gap-3">
            <span className="text-primary font-medium shrink-0">•</span>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">시장 성장 가능성</span>
              <p className="text-sm font-medium text-foreground mt-0.5">{growthPotential}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-medium shrink-0">•</span>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">주요 시장 트렌드</span>
              <p className="text-sm font-medium text-foreground mt-0.5">{marketTrends}</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="text-primary font-medium shrink-0">•</span>
            <div>
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">핵심 기회 영역</span>
              <p className="text-sm font-medium text-foreground mt-0.5">{keyOpportunities}</p>
            </div>
          </li>
        </ul>
      )}
    </ProductStrategySection>
  )
}
