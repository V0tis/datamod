/**
 * Partial pipeline resume: load completed analysis_tasks rows and rebuild in-memory state
 * so runResearch can skip upstream steps (lower API cost, faster UX).
 */
import type { SupabaseClient } from '@supabase/supabase-js'

/** Compatible with runResearch `NewsItem` (avoid circular import). */
export type ResumeNewsItem = { title: string; url: string; publisher?: string }

export type RerunPhase = 2 | 3

export type TrendDataShape = {
  summary: string
  market_score: number
  positive_signals: string[]
  neutral_signals: string[]
}

export type CompetitionDataShape = {
  competitive_landscape: Array<{
    name: string
    positioning?: string
    target_market?: string
    key_feature?: string
    pricing?: string
    differentiation?: string
    strength?: string
    weakness?: string
  }>
  market_structure?: string
}

export type InsightDataShape = {
  key_insights: string[]
  opportunity_signals: string[]
  risk_signals: string[]
  core_insights: Array<{
    title: string
    summary: string
    impact: string
    reason: string
    score?: number
  }>
}

export type PipelineResumeBeforeInsight = {
  kind: 'before_insight'
  news: ResumeNewsItem[]
  trendData: TrendDataShape
  competitionData: CompetitionDataShape
  marketOverview: string
  competitionSummary: string
}

export type PipelineResumeBeforeStrategy = {
  kind: 'before_strategy'
  news: ResumeNewsItem[]
  trendData: TrendDataShape
  competitionData: CompetitionDataShape
  insightData: InsightDataShape
  marketOverview: string
  competitionSummary: string
}

export type PipelineResumeState = PipelineResumeBeforeInsight | PipelineResumeBeforeStrategy

function newsFromSignalOutput(raw: unknown): ResumeNewsItem[] {
  if (!raw || typeof raw !== 'object') return []
  const activity = (raw as { news_activity?: unknown }).news_activity
  if (!Array.isArray(activity)) return []
  const out: ResumeNewsItem[] = []
  for (const n of activity) {
    if (!n || typeof n !== 'object') continue
    const o = n as { title?: string; url?: string; publisher?: string }
    const title = typeof o.title === 'string' ? o.title : ''
    const url = typeof o.url === 'string' ? o.url : ''
    if (!title || !url) continue
    const item: ResumeNewsItem = { title, url }
    if (typeof o.publisher === 'string' && o.publisher) item.publisher = o.publisher
    out.push(item)
  }
  return out
}

function parseTrendData(payload: unknown): TrendDataShape | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const summary = typeof p.trend_summary === 'string' ? p.trend_summary.trim() : ''
  if (!summary) return null
  const score = typeof p.market_temperature_score === 'number' ? p.market_temperature_score : 50
  const growth = Array.isArray(p.growth_signals)
    ? p.growth_signals.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  return {
    summary,
    market_score: score,
    positive_signals: growth.length > 0 ? growth : [summary.slice(0, 120)],
    neutral_signals: [],
  }
}

function parseCompetitionData(payload: unknown): CompetitionDataShape | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as {
    competitive_landscape?: Array<Record<string, unknown>>
    market_structure?: unknown
  }
  const raw = Array.isArray(p.competitive_landscape) ? p.competitive_landscape : []
  const competitive_landscape = raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null
      const name = typeof c.name === 'string' ? c.name.trim() : ''
      if (!name) return null
      const str = (k: string) => (typeof c[k] === 'string' ? (c[k] as string).trim() : undefined)
      return {
        name,
        positioning: str('positioning'),
        target_market: str('target_market'),
        key_feature: str('key_feature'),
        pricing: str('pricing'),
        differentiation: str('differentiation'),
        strength: str('strength'),
        weakness: str('weakness'),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
  const ms = p.market_structure
  const market_structure =
    ms && typeof ms === 'object' && typeof (ms as { summary?: string }).summary === 'string'
      ? (ms as { summary: string }).summary
      : undefined
  return { competitive_landscape, market_structure }
}

function parseInsightData(payload: unknown): InsightDataShape | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const key_insights = Array.isArray(p.key_insights)
    ? p.key_insights.filter((x): x is string => typeof x === 'string')
    : []
  const opportunity_signals = Array.isArray(p.opportunity_signals)
    ? p.opportunity_signals.filter((x): x is string => typeof x === 'string')
    : []
  const risk_signals = Array.isArray(p.risk_signals)
    ? p.risk_signals.filter((x): x is string => typeof x === 'string')
    : []
  const core_raw = Array.isArray(p.core_insights) ? p.core_insights : []
  const core_insights = core_raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const o = item as Record<string, unknown>
      const summary = typeof o.summary === 'string' ? o.summary.trim() : ''
      if (!summary) return null
      const title = typeof o.title === 'string' ? o.title.trim() : summary.slice(0, 18) + '…'
      const impact =
        typeof o.impact === 'string' ? o.impact.trim() : '시장·제품 의사결정에 참고할 수 있는 요인입니다.'
      const reason =
        typeof o.reason === 'string' ? o.reason.trim() : '분석 데이터를 바탕으로 도출된 인사이트입니다.'
      const score = typeof o.score === 'number' ? o.score : undefined
      return { title, summary, impact, reason, score }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  if (key_insights.length === 0 && opportunity_signals.length === 0 && core_insights.length === 0) {
    return null
  }
  return {
    key_insights,
    opportunity_signals,
    risk_signals,
    core_insights,
  }
}

async function fetchTaskMap(
  supabase: SupabaseClient,
  analysisId: string
): Promise<Record<string, { status: string; output_data: unknown }>> {
  const { data, error } = await supabase
    .from('analysis_tasks')
    .select('step_name,status,output_data')
    .eq('analysis_id', analysisId)
  if (error || !data?.length) return {}
  const map: Record<string, { status: string; output_data: unknown }> = {}
  for (const row of data as Array<{ step_name: string; status: string; output_data: unknown }>) {
    if (row.status === 'completed' && row.step_name) {
      map[row.step_name] = { status: row.status, output_data: row.output_data }
    }
  }
  return map
}

/**
 * Returns null if stored tasks are insufficient — caller should run the full pipeline.
 */
export async function loadPipelineResumeState(
  supabase: SupabaseClient,
  analysisId: string,
  phase: RerunPhase
): Promise<PipelineResumeState | null> {
  const tasks = await fetchTaskMap(supabase, analysisId)
  const signal = tasks.signal_layer?.output_data
  const trendPayload = tasks.trend_analysis?.output_data
  const competitionPayload = tasks.competition_analysis?.output_data
  const insightPayload = tasks.insight_extraction?.output_data

  const news = newsFromSignalOutput(signal)
  const trendData = parseTrendData(trendPayload)
  const competitionData = parseCompetitionData(competitionPayload)
  if (!trendData || !competitionData) return null

  const marketOverview = trendData.summary
  const competitionSummary =
    competitionData.competitive_landscape
      .map((c) => (c.positioning ? `${c.name}: ${c.positioning}` : c.name))
      .join('. ') || competitionData.market_structure || ''

  if (phase === 2) {
    return {
      kind: 'before_insight',
      news,
      trendData,
      competitionData,
      marketOverview,
      competitionSummary,
    }
  }

  const insightData = parseInsightData(insightPayload)
  if (!insightData) return null

  return {
    kind: 'before_strategy',
    news,
    trendData,
    competitionData,
    insightData,
    marketOverview,
    competitionSummary,
  }
}
