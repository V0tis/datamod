/**
 * 핵심 인사이트 목록 — KeyMarketInsightsCard / InsightStrategyTabsPanel 공통.
 */

import type { StructuredInsight } from '@/components/research/StructuredInsightCard'
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

type TaskOutput = Record<string, unknown>
type AnalysisTask = {
  step_name: string
  status: string
  output_data: unknown
}

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

export type BuildStructuredInsightsListParams = {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: AnalysisTask[] | null
  consensusData?: {
    strategicSummary?: { opportunity?: string; summary?: string }
  } | null
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
}

/**
 * pipeline `core_insights` 우선, 없으면 시장·트렌드·기회 불릿에서 구성.
 */
export function buildStructuredInsightsList({
  result,
  taskData = {},
  analysisTasks = null,
  consensusData,
  newsList = [],
}: BuildStructuredInsightsListParams): StructuredInsight[] {
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

  return coreInsightsList.length > 0 ? coreInsightsList : bulletInsights.map((t) => toStructuredInsight(t, reportAsOf))
}
