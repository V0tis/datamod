/**
 * Partial pipeline resume: load completed analysis_tasks rows and rebuild in-memory state
 * so runResearch can skip upstream steps (lower API cost, faster UX).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  normalizeOpportunitySignalsFromParse,
  normalizeRiskSignalsFromParse,
  type OpportunitySignalItem,
  type RiskSignalItem,
} from '@/lib/ai/pipeline-prompts'

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
    market_presence?: number
    /** Y축 버블: 성장성(1–10). legacy 필드명 innovation_level과 동일 의미 */
    innovation_level?: number
    key_feature?: string
    pricing?: string
    /** 레거시 한 필드 요약 */
    differentiation?: string
    /** 경쟁사 집단이 놓친 기능·가격 공백 (DATA 근거) */
    competitor_gap?: string
    /** 우리(키워드 제품)가 취할 차별화 각도 */
    our_differentiation?: string
    strength?: string
    weakness?: string
    /** 시장 점유·성장성 좌표 산정 근거 (로드맵·OKR 근거용) */
    score_rationale?: string
  }>
  market_structure?: string
  /** 기능·가격 차원 Strategic Gap */
  strategic_gaps?: {
    functional?: string[]
    pricing?: string[]
    summary?: string
  }
  /** 로드맵·OKR에 바로 쓰는 PM 요약: 이 분석이 기획 근거가 되는 이유 */
  pm_planning_summary?: string
  strategic_action_plan?: {
    roadmap_priorities?: Array<{ title: string; rationale?: string; priority_rank?: number }>
    okr_key_results?: Array<{ objective?: string; key_results?: string[] }>
  }
}

export type InsightDataShape = {
  key_insights: string[]
  opportunity_signals: OpportunitySignalItem[]
  risk_signals: RiskSignalItem[]
  core_insights: Array<{
    title: string
    summary: string
    impact: string
    reason: string
    score?: number
    source_timestamp?: string
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

function clampCompetitorScore1to10(n: unknown): number | undefined {
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  return Math.min(10, Math.max(1, Math.round(n)))
}

function parseCompetitionData(payload: unknown): CompetitionDataShape | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as {
    competitive_landscape?: Array<Record<string, unknown>>
    market_structure?: unknown
    strategic_gaps?: unknown
    pm_planning_summary?: unknown
    strategic_action_plan?: unknown
  }
  const raw = Array.isArray(p.competitive_landscape) ? p.competitive_landscape : []
  const competitive_landscape = raw
    .map((c) => {
      if (!c || typeof c !== 'object') return null
      const name = typeof c.name === 'string' ? c.name.trim() : ''
      if (!name) return null
      const str = (k: string) => (typeof c[k] === 'string' ? (c[k] as string).trim() : undefined)
      const yScore = c.innovation_level ?? c.growth_score
      return {
        name,
        positioning: str('positioning'),
        target_market: str('target_market'),
        market_presence: clampCompetitorScore1to10(c.market_presence),
        innovation_level: clampCompetitorScore1to10(yScore),
        key_feature: str('key_feature'),
        pricing: str('pricing'),
        differentiation: str('differentiation'),
        competitor_gap: str('competitor_gap'),
        our_differentiation: str('our_differentiation'),
        strength: str('strength'),
        weakness: str('weakness'),
        score_rationale: str('score_rationale'),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)
  const ms = p.market_structure
  const market_structure =
    ms && typeof ms === 'object' && typeof (ms as { summary?: string }).summary === 'string'
      ? (ms as { summary: string }).summary
      : undefined

  let strategic_gaps: CompetitionDataShape['strategic_gaps']
  const sg = p.strategic_gaps
  if (sg && typeof sg === 'object') {
    const o = sg as Record<string, unknown>
    const functional = Array.isArray(o.functional_gaps)
      ? o.functional_gaps.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : Array.isArray(o.functional)
        ? o.functional.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : undefined
    const pricing = Array.isArray(o.pricing_gaps)
      ? o.pricing_gaps.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : Array.isArray(o.pricing)
        ? o.pricing.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : undefined
    const summary = typeof o.summary === 'string' ? o.summary.trim() : undefined
    if (functional?.length || pricing?.length || summary) strategic_gaps = { functional, pricing, summary }
  }

  const pm_planning_summary =
    typeof p.pm_planning_summary === 'string' ? p.pm_planning_summary.trim() : undefined

  let strategic_action_plan: CompetitionDataShape['strategic_action_plan']
  const sap = p.strategic_action_plan
  if (sap && typeof sap === 'object') {
    const o = sap as Record<string, unknown>
    const roadmap_priorities = Array.isArray(o.roadmap_priorities)
      ? o.roadmap_priorities
          .map((r) => {
            if (!r || typeof r !== 'object') return null
            const x = r as Record<string, unknown>
            const title = typeof x.title === 'string' ? x.title.trim() : ''
            if (!title) return null
            return {
              title,
              rationale: typeof x.rationale === 'string' ? x.rationale.trim() : undefined,
              priority_rank: typeof x.priority_rank === 'number' ? x.priority_rank : undefined,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x != null)
      : undefined
    const okr_key_results = Array.isArray(o.okr_key_results)
      ? o.okr_key_results
          .map((r) => {
            if (!r || typeof r !== 'object') return null
            const x = r as Record<string, unknown>
            const key_results = Array.isArray(x.key_results)
              ? x.key_results.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
              : undefined
            return {
              objective: typeof x.objective === 'string' ? x.objective.trim() : undefined,
              key_results,
            }
          })
          .filter((x): x is NonNullable<typeof x> => x != null)
      : undefined
    if (roadmap_priorities?.length || okr_key_results?.length) {
      strategic_action_plan = { roadmap_priorities, okr_key_results }
    }
  }

  return {
    competitive_landscape,
    market_structure,
    ...(strategic_gaps ? { strategic_gaps } : {}),
    ...(pm_planning_summary ? { pm_planning_summary } : {}),
    ...(strategic_action_plan ? { strategic_action_plan } : {}),
  }
}

function parseInsightData(payload: unknown): InsightDataShape | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const key_insights = Array.isArray(p.key_insights)
    ? p.key_insights.filter((x): x is string => typeof x === 'string')
    : []
  const opportunity_signals = normalizeOpportunitySignalsFromParse(
    Array.isArray(p.opportunity_signals) ? (p.opportunity_signals as unknown[]) : undefined
  )
  const risk_signals = normalizeRiskSignalsFromParse(
    Array.isArray(p.risk_signals) ? (p.risk_signals as unknown[]) : undefined
  )
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
      let source_timestamp: string | undefined
      if (typeof o.source_timestamp === 'string' && o.source_timestamp.trim()) {
        const d = new Date(o.source_timestamp.trim())
        if (!Number.isNaN(d.getTime())) source_timestamp = d.toISOString()
      }
      return { title, summary, impact, reason, score, ...(source_timestamp ? { source_timestamp } : {}) }
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

/** 완료된 단계만 포함한 analysis_tasks 맵 (단계 재시도·복구용) */
export async function fetchTaskMap(
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

export type ClientPipelineTaskSnapshotRow = {
  step_name: string
  status: string
  output_data?: unknown
}

/** 단일 단계 재실행 시 서버 DB에 없을 수 있는 클라이언트 보관 output을 병합 */
export function mergeServerTaskMapWithClientSnapshot(
  server: Record<string, { status: string; output_data: unknown }>,
  clientRows: ClientPipelineTaskSnapshotRow[] | null | undefined
): Record<string, { status: string; output_data: unknown }> {
  if (!clientRows?.length) return server
  const out: Record<string, { status: string; output_data: unknown }> = { ...server }
  for (const row of clientRows) {
    if (row.status !== 'completed' || row.output_data == null || typeof row.output_data !== 'object') continue
    const prev = out[row.step_name]
    const hasPayload =
      prev?.output_data != null &&
      typeof prev.output_data === 'object' &&
      Object.keys(prev.output_data as object).length > 0
    if (!hasPayload) {
      out[row.step_name] = { status: 'completed', output_data: row.output_data }
    }
  }
  return out
}

/** 클라이언트 스냅샷으로 보강된 단계를 DB에 기록해 이후 loadPipelineResumeState가 동작하게 함 */
export async function persistMergedTasksMissingOnServer(
  supabase: SupabaseClient,
  analysisId: string,
  serverBefore: Record<string, { status: string; output_data: unknown }>,
  merged: Record<string, { status: string; output_data: unknown }>
): Promise<void> {
  const now = new Date().toISOString()
  for (const [stepName, row] of Object.entries(merged)) {
    if (row.status !== 'completed' || row.output_data == null) continue
    const had = serverBefore[stepName]?.output_data
    const hadPayload =
      had != null && typeof had === 'object' && Object.keys(had as object).length > 0
    if (hadPayload) continue
    await supabase.from('analysis_tasks').upsert(
      {
        analysis_id: analysisId,
        step_name: stepName,
        status: 'completed',
        started_at: now,
        completed_at: now,
        output_data: row.output_data,
        error_message: null,
        updated_at: now,
      },
      { onConflict: 'analysis_id,step_name' }
    )
  }
}

const STEP_LABELS_KO: Record<string, string> = {
  signal_layer: '데이터 수집',
  trend_analysis: '시장 분석',
  competition_analysis: '경쟁 분석',
  insight_extraction: '인사이트',
  strategy_generation: '전략',
  execution_layer: 'PM 액션',
  risk_opportunity: '리스크·기회 평가',
}

/**
 * 단계 재실행 전 필수 선행 태스크가 analysis_tasks(또는 병합 맵)에 있는지 검증.
 */
export function validateRetryPipelinePrerequisites(
  step: 'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity',
  tasksMap: Record<string, { status: string; output_data?: unknown }>
): { ok: true } | { ok: false; message: string; missing: string[] } {
  const required: Record<typeof step, string[]> = {
    insight_extraction: ['trend_analysis', 'competition_analysis'],
    strategy_generation: ['trend_analysis', 'competition_analysis', 'insight_extraction'],
    execution_layer: ['strategy_generation'],
    risk_opportunity: ['strategy_generation', 'execution_layer'],
  }
  const need = required[step]
  const missing: string[] = []
  for (const name of need) {
    const row = tasksMap[name]
    const od = row?.output_data
    const ok =
      row?.status === 'completed' &&
      od != null &&
      typeof od === 'object' &&
      Object.keys(od as object).length > 0
    if (!ok) missing.push(name)
  }
  if (missing.length === 0) return { ok: true }
  const detail = missing.map((m) => STEP_LABELS_KO[m] ?? m).join(', ')
  return {
    ok: false,
    missing,
    message: `이 단계를 다시 실행하려면 다음 단계의 저장된 결과가 필요합니다: ${detail}. 전체 다시 분석을 실행하거나, 분석 완료 후 다시 시도해 주세요.`,
  }
}
