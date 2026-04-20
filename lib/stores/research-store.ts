'use client'

/**
 * Global analysis state: single source of truth for all analysis tasks.
 * - Tasks are first-class (id, keyword, status, progress, result, createdAt).
 * - Backing data comes from Supabase analysis_jobs + research_history; sync via API + Realtime.
 * - UI only reads and triggers; orchestration (start, retry, cancel, refresh) lives here.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import type { AnalysisTask, AnalysisStatus } from '@/lib/analysis-types'
import { jobStatusToTaskStatus } from '@/lib/analysis-types'
import {
  type AnalysisMode,
  type AnalysisProgressMeta,
  type StreamingState,
  DEFAULT_ANALYSIS_MODE,
  ANALYSIS_MODE_STEPS,
  createIdleState,
  createRunningState,
  createStreamingState,
  createCompletedState,
  createErrorState,
  isAnalyzing,
  getStepCount,
} from '@/lib/types/analysis-modes'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
import { normalizeActivityStepId } from '@/lib/analysis/pipeline-activity-step'
import { writePipelineClientCache, readPipelineClientCache } from '@/lib/analysis/pipeline-client-cache'
import { buildInsightSuggestionRequestBody } from '@/lib/insight-suggestion/build-request-body'
import type { InsightSuggestionResult } from '@/lib/types/insight-suggestion'

export interface NewsItem {
  title: string
  url: string
  content?: string
  /** 썸네일 이미지 URL (선택) */
  image?: string
  /** 언론사/출처 (도메인 등) */
  publisher?: string
  /** 업로드/수집 시각 ISO 문자열 (표시: n시간 전) */
  publishedAt?: string
}

export interface ChartData {
  sentiment: { positive: number; neutral: number; negative: number }
  impact: Array<{ subject: string; score: number }>
}

export interface ResearchResponse {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: number
  publicReactionTrends?: string
  chartData?: ChartData
  articleSummaries?: string[]
  reportId?: string | null
  /** Depth used for this run: fast | standard | deep (for result page badges) */
  analysis_depth?: 'fast' | 'standard' | 'deep' | null
  /** true if Serper web search was used for this analysis */
  serper_used?: boolean
  error?: string
  /** 핵심 결론 3가지 (하단 Badge용) */
  keyConclusions?: string[]
  /** DB 캐시 복원 시 탭 분석 결과 (logic, creative, fact) */
  ai_responses?: Record<string, string>
  /** 참고 문헌 (뉴스/소스 링크) */
  source_links?: Array<{ title?: string; url?: string }>
  /** research_history.updated_at (마지막 분석 시간) */
  updated_at?: string
  /** Groq 분석 결과 (research_history.analysis_groq). 탭별 creative/fact (logic 미사용) */
  analysis_groq?: { summary?: string; modelName?: string; creative?: string; fact?: string }
  /** Gemini 탭 분석 결과 (research_history.analysis_gemini). 탭별 creative/fact */
  analysis_gemini?: Record<string, string>
  /** AI Insight Consensus (research_history.analysis_results). summary, sentiment, strategic_insight, action_item, confidence */
  analysis_results?: { summary?: string; sentiment?: number; strategic_insight?: string; action_item?: string; confidence?: number }
  /** research_history.key_metrics (chartData, keyConclusions, sentiment, structured PM fields) */
  key_metrics?: {
    chartData?: ChartData
    keyConclusions?: string[]
    sentiment?: number
    facts?: string[]
    hypotheses?: string[]
    inferences?: string[]
    positive_signals?: string[]
    neutral_signals?: string[]
    negative_risks?: string[]
    /** PM 리스크 신호등 UI용 (severity×likelihood, 최대 100) */
    risk_signals?: Array<{ risk: string; severity: number; likelihood: number }>
    market_temperature_score?: number
    confidence_score?: number
    analysis_target?: string
    opportunity_score?: number
    opportunity_score_breakdown?: {
      market_growth?: number
      competition_density?: number
      trend_momentum?: number
      funding_signals?: number
      risk_factors?: number
      competition_pressure?: number
      user_demand?: number
      product_differentiation?: number
      market_timing?: number
    }
    opportunity_score_reasoning?: string
    opportunity_score_summary_text?: string
    opportunity_score_reason_text?: string
    summary_insights?: string
    background_rationale?: string
    conclusion_three_lines?: string[]
    pm_actions?: {
      recommended_actions?: Array<{ title: string; reasoning?: string; urgency_level?: 'low' | 'medium' | 'high'; related_risk?: string }>
      monitoring_points?: string[]
      decision_risks?: string[]
    }
    /** Product strategy focus */
    market_summary?: string
    key_strategic_insights?: string[]
    /** Core Insight tab: structured insights with title, summary, impact, reason */
    core_insights?: Array<{ title: string; summary: string; impact: string; reason: string; score?: number; source_timestamp?: string }>
    competitive_landscape?: Array<{
      name?: string
      positioning?: string
      target_market?: string
      market_presence?: number
      innovation_level?: number
      key_feature?: string
      pricing?: string
      differentiation?: string
      competitor_gap?: string
      our_differentiation?: string
      strength?: string
      weakness?: string
      score_rationale?: string
    }>
    strategic_gaps?: {
      functional?: string[]
      pricing?: string[]
      summary?: string
    }
    pm_planning_summary?: string
    strategic_action_plan?: {
      roadmap_priorities?: Array<{ title: string; rationale?: string; priority_rank?: number }>
      okr_key_results?: Array<{ objective?: string; key_results?: string[] }>
    }
    opportunity_areas?: string[]
    recommended_product_strategy?: {
      summary?: string
      product_idea?: string
      target_customer?: string
      monetization?: string
    }
    pm_action_plan?: Array<{
      action_title: string
      description?: string
      expected_outcome?: string
      priority?: 'high' | 'medium' | 'low'
      category?: 'mvp_experiment' | 'user_interview' | 'feature_prioritization' | 'go_to_market'
    }>
    next_actions_pm?: Array<{
      action?: string
      why?: string
      how_to_execute?: string
      priority?: 'high' | 'medium' | 'low'
      estimated_effort?: string
    }>
    chart_insights?: {
      search_trend?: { insight?: string; takeaway?: string }
      market_size?: { insight?: string; takeaway?: string }
      adoption_rate?: { insight?: string; takeaway?: string }
      score_distribution?: { insight?: string; takeaway?: string }
    }
    strategic_decision_layer?: {
      opportunity_score_reason_text?: string
      market_opportunity_explanation?: string
      competition_intensity?: 'low' | 'medium' | 'high'
      competition_explanation?: string
      product_market_fit?: 'low' | 'medium' | 'high'
      product_market_fit_explanation?: string
      entry_strategy?: string
      entry_explanation?: string
    }
    /** Porter 보강·전략 요약용 수치 (runResearch / 파서에서 채움) */
    strategy_evaluation?: {
      cross_validation_score?: number
      cross_validation_summary?: string
      risk_items?: Array<{ issue: string; mitigation_level: string; plan: string }>
      opportunity_items?: Array<{ value: string; difficulty_level: string; priority: number }>
      competition_risk?: number
      growth_potential?: number
      market_attractiveness?: number
      execution_difficulty?: number
      market_attractiveness_label?: string
      market_attractiveness_reason?: string
      competition_risk_label?: string
      competition_risk_reason?: string
      execution_difficulty_label?: string
      execution_difficulty_reason?: string
      growth_potential_label?: string
      growth_potential_reason?: string
    }
    swot_analysis?: {
      strengths?: string[]
      weaknesses?: string[]
      opportunities?: string[]
      threats?: string[]
    }
    jtbd?: {
      main_jobs?: string[]
      pains?: string[]
      gains?: string[]
      functional_jobs?: string[]
      social_jobs?: string[]
      emotional_jobs?: string[]
    }
    porter_5_forces?: {
      rivalry?: string[]
      supplier_power?: string[]
      buyer_power?: string[]
      substitutes?: string[]
      new_entrants?: string[]
      scores?: {
        new_entrants?: number
        supplier_power?: number
        buyer_power?: number
        substitutes?: number
        rivalry?: number
      }
    }
  }
}

type ResearchStatus = 'idle' | 'loading' | 'done' | 'error'

/** Canonical analysis status for UI. Single source of truth. */
export type CanonicalAnalysisStatus = AnalysisStatus

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

/** API/DB shape; use getTasks() for the public AnalysisTask[] view. */
export interface AnalysisJob {
  id: string
  keyword: string
  country_code: string
  status: JobStatus
  progress_step?: string | null
  error?: string | null
  report_id?: string | null
  created_at?: string
  updated_at?: string
}

const PROGRESS_LABELS: Record<string, string> = {
  news: '뉴스 수집',
  gemini: 'AI 분석',
  creative: '인사이트 생성',
  parse_json: '결과 정리',
  report_db: '리포트 저장',
  done: '완료',
  cached: '캐시 사용',
}

/** Prefer running > succeeded > queued > failed so completed results aren't hidden by a queued retry. */
function jobStatusRank(status: JobStatus): number {
  switch (status) {
    case 'running': return 0
    case 'succeeded': return 1
    case 'queued': return 2
    case 'failed':
    case 'cancelled': return 3
    default: return 4
  }
}

/** Queue view: one visible task per keyword. Prefer running > queued > succeeded > failed; then latest by updated_at. */
function pickOneJobIdPerKey(jobs: Record<string, AnalysisJob>, jobOrder: string[]): string[] {
  const byKey = new Map<string, string>()
  for (const id of jobOrder) {
    const job = jobs[id]
    if (!job) continue
    const key = `${(job.keyword ?? '').trim()}|${(job.country_code ?? 'KR').trim() || 'KR'}`
    const existingId = byKey.get(key)
    const existing = existingId ? jobs[existingId] : null
    const updated = job.updated_at ?? job.created_at ?? ''
    const existingUpdated = existing?.updated_at ?? existing?.created_at ?? ''
    const preferThis =
      !existing ||
      jobStatusRank(job.status) < jobStatusRank(existing.status) ||
      (jobStatusRank(job.status) === jobStatusRank(existing.status) && updated >= existingUpdated)
    if (preferThis) byKey.set(key, id)
  }
  return Array.from(byKey.values())
}

/** Derive AnalysisTask[] from store: one task per keyword (deduplicated queue view). */
export function getTasksFromStore(): AnalysisTask[] {
  const state = useResearchStore.getState()
  const jobs = state.jobs
  const order = pickOneJobIdPerKey(jobs, state.jobOrder)
  return order.map((id) => {
    const job = jobs[id]
    if (!job) return null
    const status = jobStatusToTaskStatus(job.status)
    const createdAt = job.created_at ?? ''
    const updatedAt = job.updated_at ?? createdAt
    return {
      id: job.id,
      keyword: job.keyword,
      status,
      progress: job.progress_step ? (PROGRESS_LABELS[job.progress_step] ?? job.progress_step) : null,
      result: job.status === 'succeeded' ? undefined : null,
      createdAt,
      startedAt: createdAt,
      completedAt: status === 'completed' || status === 'failed' ? updatedAt : null,
      countryCode: job.country_code ?? 'KR',
      error: job.error ?? null,
    }
  }).filter(Boolean) as AnalysisTask[]
}

/** Number of tasks that are pending or running. */
export function getRunningCountFromStore(): number {
  const state = useResearchStore.getState()
  return Object.values(state.jobs).filter(
    (j) => j.status === 'queued' || j.status === 'running'
  ).length
}

export interface GeminiQuota {
  used: number
  limit: number
}

interface ResearchState {
  keyword: string
  status: ResearchStatus
  /** Canonical status for UI. Render ONLY from this. */
  analysisStatus: CanonicalAnalysisStatus
  /** Selected analysis mode for current/next analysis */
  analysisMode: AnalysisMode
  /** Explicit streaming state machine for progress tracking */
  streamingState: StreamingState
  /** Current step index (0-based) during analysis */
  currentStep: number
  /** Total steps for current analysis mode */
  totalSteps: number
  newsList: NewsItem[]
  /** Composed from sections; do not set directly. */
  result: ResearchResponse | null
  /** Section-level state; updates independent of full result. */
  summarySection: SummarySection | null
  marketTemperatureSection: MarketTemperatureSection | null
  recommendedActionsSection: RecommendedActionsSection | null
  insightsSection: InsightsSection | null
  error: string | null
  insights: string | null
  /** Gemini 오늘 사용량 (에너지 바용). null이면 아직 로드 안 함 */
  geminiQuota: GeminiQuota | null
  jobs: Record<string, AnalysisJob>
  jobOrder: string[]
  activeJobId: string | null
  /** Last successful report for recovery on error */
  lastSuccessfulReport: ResearchResponse | null
  /** Per-task partial data from analysis console (task ID -> data) */
  taskData: Partial<Record<string, unknown>>
  /** Current analysis run ID for polling (userId|keyword|country) */
  analysisId: string | null
  /** Polled task status from backend (source of truth for timeline) */
  analysisTasks: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    output_data: unknown
    error_message: string | null
    provider?: string | null
    fallback_used?: boolean
    primary_provider_error?: string | null
  }> | null
  /** 최근 스트리밍 활동 로그 (단계별 stepId, 최대 150행) */
  streamingActivityLog: Array<{ ts: number; message: string; kind?: 'error'; type?: 'error'; stepId?: string }>
  /** 서버가 `cached` 스트림으로 즉시 완료한 경우(캐시 히트 UI용) */
  pipelineServedFromServerCache: boolean
  /** 마지막 분석 실행 국가 (인사이트 제안 API 등) */
  analysisCountryCode: string
  /** 실시간 인사이트 제안(코호트 DB 집계 아님, 현재 분석 컨텍스트 기반) */
  liveInsightSuggestion: InsightSuggestionResult | null
  liveInsightSuggestionLoading: boolean
}

/** Section-level state to avoid monolithic setResult; each section updates independently. */
export interface SummarySection {
  summaryText: string
  trend: 'rising' | 'stable' | 'declining'
  confidence: number | null
  analysis_target: string | null
  updated_at: string | null
  reportId: string | null
  keyConclusions: string[]
  marketNews: string[]
  painPoints: string[]
  competitorTrends: string
  sentiment: number | null
  chartData: ChartData | null
  source_links: Array<{ title?: string; url?: string }>
  analysis_groq?: ResearchResponse['analysis_groq']
  analysis_gemini?: ResearchResponse['analysis_gemini']
  analysis_results?: ResearchResponse['analysis_results']
}
export interface MarketTemperatureSection {
  score: number
  trend: 'rising' | 'stable' | 'declining'
  positiveSignals: string[]
  neutralSignals: string[]
  negativeRisks: string[]
}
export interface RecommendedActionsSection {
  actions: Array<{ title: string; reasoning?: string; urgency_level?: 'low' | 'medium' | 'high'; related_risk?: string }>
  monitoring_points: string[]
}
export interface InsightsSection {
  facts: string[]
  hypotheses: string[]
  inferences: string[]
}

/** 스트리밍 중 pass2 등으로 compose할 때 기존 파이프라인 필드(conclusion_three_lines 등)를 유지 */
function composeResultFromSections(
  summary: SummarySection | null,
  market: MarketTemperatureSection | null,
  actions: RecommendedActionsSection | null,
  insights: InsightsSection | null,
  prevResult?: ResearchResponse | null
): ResearchResponse | null {
  if (!summary) return null
  const prevKm = prevResult?.key_metrics
  return {
    reportId: summary.reportId,
    updated_at: summary.updated_at ?? undefined,
    keyConclusions: summary.keyConclusions,
    marketNews: summary.marketNews,
    painPoints: summary.painPoints,
    competitorTrends: summary.competitorTrends,
    sentiment: summary.sentiment ?? undefined,
    chartData: summary.chartData ?? undefined,
    source_links: summary.source_links,
    analysis_groq: summary.analysis_groq,
    analysis_gemini: summary.analysis_gemini,
    analysis_results: summary.analysis_results,
    key_metrics: {
      ...(prevKm && typeof prevKm === 'object' ? prevKm : {}),
      analysis_target: summary.analysis_target ?? undefined,
      confidence_score: summary.confidence ?? undefined,
      summary_insights: summary.summaryText || undefined,
      keyConclusions: summary.keyConclusions,
      market_temperature_score: market?.score ?? undefined,
      sentiment: summary.sentiment ?? undefined,
      positive_signals: market?.positiveSignals,
      neutral_signals: market?.neutralSignals,
      negative_risks: market?.negativeRisks,
      facts: insights?.facts,
      hypotheses: insights?.hypotheses,
      inferences: insights?.inferences,
      pm_actions: actions ? { recommended_actions: actions.actions, monitoring_points: actions.monitoring_points, decision_risks: [] } : prevKm?.pm_actions,
    },
  }
}

/** strategy_generation 태스크 output_data의 three_line_actions → UI/저장용 1~3줄 */
export function threeLinesFromStrategyTaskOutput(data: unknown): string[] | undefined {
  if (!data || typeof data !== 'object') return undefined
  const raw = (data as { three_line_actions?: unknown }).three_line_actions
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const lines = raw
    .filter((x): x is string => typeof x === 'string')
    .map((s) => {
      const t = s.replace(/\s+/g, ' ').trim()
      if (t.length <= 120) return t
      return `${t.slice(0, 119).trimEnd()}…`
    })
    .filter((s) => s.length > 0)
    .slice(0, 3)
  return lines.length > 0 ? lines : undefined
}

/** DB key_metrics에 전략 3줄이 없을 때 analysis_tasks의 strategy_generation 출력으로 보강 */
function enrichKeyMetricsFromPipelineTaskData(
  km: ResearchResponse['key_metrics'] | undefined,
  taskData: Partial<Record<string, unknown>>
): ResearchResponse['key_metrics'] | undefined {
  const hasTask = taskData && typeof taskData === 'object' && Object.keys(taskData).length > 0
  if (!km && !hasTask) return km
  let m = { ...(km && typeof km === 'object' ? km : {}) } as NonNullable<ResearchResponse['key_metrics']>
  const stratRaw = taskData['strategy_generation']
  const three = threeLinesFromStrategyTaskOutput(stratRaw)
  if (three?.length && !(m.conclusion_three_lines && m.conclusion_three_lines.length > 0)) {
    m = { ...m, conclusion_three_lines: three }
  }
  if (stratRaw && typeof stratRaw === 'object') {
    const so = stratRaw as Record<string, unknown>
    const ms = typeof so.market_summary === 'string' ? so.market_summary.trim() : ''
    const prevMs = typeof m.market_summary === 'string' ? m.market_summary.trim() : ''
    if (ms.length > 8 && prevMs.length < 9) {
      m = { ...m, market_summary: ms }
    }
    const prevKi = m.key_strategic_insights
    if (!(Array.isArray(prevKi) && prevKi.length > 0) && Array.isArray(so.key_strategic_insights)) {
      const ki = (so.key_strategic_insights as unknown[]).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      if (ki.length) m = { ...m, key_strategic_insights: ki }
    }
  }
  return Object.keys(m as object).length > 0 ? (m as ResearchResponse['key_metrics']) : km
}

/** loadFromHistory 반환: 'cached' = 캐시 있음 사용함, 'empty' = 기록 있으나 내용 없음, 'none' = 기록 없음, 'error' = 요청 실패(스트림 시작 금지) */
export type LoadHistoryResult = 'cached' | 'empty' | 'none' | 'error'

type TabId = 'logic' | 'creative' | 'fact'

/** DB/API sometimes returns JSON as string; normalize to object for store. Never throws. */
function parseJsonField<T>(value: unknown): T | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s || s.length > 500_000) return undefined
    const first = s[0]
    const last = s[s.length - 1]
    if ((first !== '{' && first !== '[') || (last !== '}' && last !== ']')) return undefined
    try {
      const parsed = JSON.parse(s) as unknown
      return parsed as T
    } catch {
      return undefined
    }
  }
  return value as T
}

/** Streaming update payload from parsed sections + metadata. */
export type StreamingUpdatePayload = {
  summary?: string
  temperature?: number
  insightLines?: string[]
  actionLines?: Array<{ title: string; reasoning: string; urgency: 'low' | 'medium' | 'high' }>
  /** Append single insight (NDJSON streaming) */
  appendInsight?: string
  /** Append single action (NDJSON streaming) */
  appendAction?: { title: string; reasoning: string; urgency: 'low' | 'medium' | 'high' }
  reportId?: string | null
  newsList?: NewsItem[]
  analysis_depth?: 'fast' | 'standard' | 'deep' | null
  serper_used?: boolean
  error?: string
}

/** AbortController reference for cancelling in-progress analysis */
let currentAbortController: AbortController | null = null

interface ResearchStore extends ResearchState {
  /** Apply streaming section updates. Composes result from sections. */
  applyStreamingUpdate: (payload: StreamingUpdatePayload) => void
  /** Start analysis via streaming API (replaces job polling). */
  startStreamingResearch: (
    keyword: string,
    options?: {
      country_code?: string
      mode?: AnalysisMode
      ai_primary_model?: 'gemini' | 'groq'
      force_reanalyze?: boolean
      /** 2: 인사이트부터, 3: 전략부터. 1은 전체 재분석과 동일 → force_reanalyze 사용 */
      rerun_from_phase?: 1 | 2 | 3
      /** 실패한 단계만 API 재호출 (인사이트·전략·실행·리스크) */
      retry_pipeline_step?: 'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity'
    }
  ) => Promise<void>
  /** Abort current analysis in progress */
  abortAnalysis: () => void
  /** Set analysis mode for next analysis */
  setAnalysisMode: (mode: AnalysisMode) => void
  /** Update streaming state (internal use) */
  setStreamingState: (state: StreamingState) => void
  /** Update step progress (internal use) */
  setStepProgress: (
    currentStep: number,
    stepId: string,
    retryMessage?: string,
    currentArticleTitle?: string,
    progressMeta?: AnalysisProgressMeta
  ) => void
  /** Set task data (internal use) */
  setTaskData: (taskId: string, data: unknown) => void
  /** Set analysis ID for polling */
  setAnalysisId: (id: string | null) => void
  /** Set polled analysis tasks */
  setAnalysisTasks: (tasks: ResearchState['analysisTasks']) => void
  /** Merge a streaming task into analysisTasks for immediate timeline update */
  mergeStreamingTaskIntoAnalysisTasks: (
    stepName: string,
    status: 'completed' | 'failed' | 'running',
    opts?: { outputData?: unknown; errorMessage?: string | null; provider?: string | null; fallback_used?: boolean; primary_provider_error?: string | null }
  ) => void
  /** Check if analysis is currently running */
  isAnalyzingNow: () => boolean
  startResearch: (keyword: string, options?: { fromRetry?: boolean; country_code?: string }) => void
  refreshJobs: () => Promise<void>
  setActiveJob: (jobId: string | null) => Promise<void>
  setActiveJobByKeyword: (keyword: string) => Promise<void>
  retryJob: (jobId: string) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  /** research_history 캐시 조회. 캐시 있으면 복원 후 'cached', 비어있으면 'empty', 없으면 'none'. */
  loadFromHistory: (keyword: string, countryCode?: string) => Promise<LoadHistoryResult>
  /** 현재 스토어의 리서치 데이터만으로 인사이트 제안 API 호출 */
  refreshLiveInsightSuggestion: () => Promise<void>
  /** 폴링 결과로 즉시 result 갱신 (분석 완료 시 자동 렌더용) */
  hydrateFromStatusResult: (keyword: string, countryCode: string, pollResult: { reportId?: string; key_metrics?: unknown; content?: Record<string, unknown>; source_links?: unknown[]; updated_at?: string }) => void
  /** 키워드로 DB에 캐시된 리포트가 있으면 복원하고 true 반환. 없으면 false. */
  loadReportByKeyword: (keyword: string) => Promise<boolean>
  /** 탭 API 응답을 result에 병합. refetch 없이 UI/동기화 effect에 반영. */
  mergeResultAnalysis: (tabId: TabId, groqText: string | null, geminiText: string | null) => void
  /** Recover from error using last successful report */
  recoverFromError: () => boolean
  setInsights: (value: string | null) => void
  setGeminiQuota: (quota: GeminiQuota | null) => void
  fetchGeminiQuota: () => Promise<void>
  reset: () => void
  /** Reset error/streaming when route (keyword|country) changes. Prevents showing stale failed state. */
  resetForRouteChange: (keyword: string) => void
}

const initialState: ResearchState = {
  keyword: '',
  status: 'idle',
  analysisStatus: 'queued',
  analysisMode: DEFAULT_ANALYSIS_MODE,
  streamingState: createIdleState(),
  currentStep: 0,
  totalSteps: getStepCount(DEFAULT_ANALYSIS_MODE),
  newsList: [],
  result: null,
  summarySection: null,
  marketTemperatureSection: null,
  recommendedActionsSection: null,
  insightsSection: null,
  error: null,
  insights: null,
  geminiQuota: null,
  jobs: {},
  jobOrder: [],
  activeJobId: null,
  lastSuccessfulReport: null,
  taskData: {},
  analysisId: null,
  analysisTasks: null,
  streamingActivityLog: [],
  pipelineServedFromServerCache: false,
  analysisCountryCode: 'KR',
  liveInsightSuggestion: null,
  liveInsightSuggestionLoading: false,
}

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setInsights: (value) => set({ insights: value }),
      setGeminiQuota: (quota) => set({ geminiQuota: quota }),
      fetchGeminiQuota: async () => {
        try {
          const res = await fetch('/api/usage')
          const data = (await res.json()) as { gemini?: { used: number; limit: number } }
          if (data.gemini) set({ geminiQuota: data.gemini })
        } catch {
          set({ geminiQuota: null })
        }
      },
      reset: () =>
        set({
          ...initialState,
          analysisStatus: 'queued',
          liveInsightSuggestion: null,
          liveInsightSuggestionLoading: false,
        }),

      resetForRouteChange: (keyword: string) => {
        const k = (keyword ?? '').trim()
        const storeK = (get().keyword ?? '').trim()
        const isNewSelection = k !== storeK
        set({
          error: null,
          streamingState: createIdleState(),
          pipelineServedFromServerCache: false,
          ...(isNewSelection
            ? {
                result: null,
                analysisTasks: null,
                taskData: {},
                status: 'idle' as const,
                analysisStatus: 'queued' as CanonicalAnalysisStatus,
                summarySection: null,
                marketTemperatureSection: null,
                recommendedActionsSection: null,
                insightsSection: null,
              }
            : {}),
        })
      },

      setAnalysisMode: (mode: AnalysisMode) => {
        set({
          analysisMode: mode,
          totalSteps: getStepCount(mode),
        })
      },

      setStreamingState: (state: StreamingState) => {
        set({ streamingState: state })
      },

      setStepProgress: (currentStep, stepId, retryMessage, currentArticleTitle, progressMeta) => {
        const mode = get().analysisMode
        const prev = get().streamingState
        const prevMeta =
          (prev.status === 'streaming' || prev.status === 'running') && prev.progressMeta
            ? prev.progressMeta
            : undefined
        const merged =
          progressMeta != null
            ? { ...prevMeta, ...progressMeta }
            : prevMeta
        set({
          currentStep,
          streamingState: createStreamingState(
            mode,
            currentStep,
            stepId,
            retryMessage,
            currentArticleTitle,
            merged
          ),
        })
      },

      setTaskData: (taskId: string, data: unknown) => {
        set((s) => ({
          taskData: { ...s.taskData, [taskId]: data },
        }))
      },

      setAnalysisId: (id: string | null) => {
        set({ analysisId: id })
      },

      setAnalysisTasks: (tasks: ResearchState['analysisTasks']) => {
        set({ analysisTasks: tasks })
      },

      /** Merge a streaming task into analysisTasks so timeline shows it immediately. */
      mergeStreamingTaskIntoAnalysisTasks: (
        stepName: string,
        status: 'completed' | 'failed' | 'running',
        opts?: { outputData?: unknown; errorMessage?: string | null; provider?: string | null; fallback_used?: boolean; primary_provider_error?: string | null }
      ) => {
        /** `/api/research/tasks`·runResearch와 동일 순서. 누락 시 병합마다 해당 단계가 사라져 타임라인이 대기로 되돌아감 */
        const STEP_ORDER = [
          'signal_layer',
          'trend_analysis',
          'competition_analysis',
          'insight_extraction',
          'strategy_generation',
          'execution_layer',
          'risk_opportunity',
        ] as const
        set((s) => {
          const prev = s.analysisTasks ?? []
          const byStep = new Map(prev.map((t) => [t.step_name, t]))
          type Row = (typeof prev)[0]
          const prevRow = byStep.get(stepName)
          const base: Row =
            prevRow ??
            ({
              step_name: stepName,
              status: 'pending' as const,
              output_data: null,
              error_message: null,
              started_at: null,
              completed_at: null,
              provider: null,
              fallback_used: false,
              primary_provider_error: null,
            } as Row)
          const nextRow: Row = {
            ...base,
            step_name: stepName,
            status,
            ...(opts?.outputData !== undefined ? { output_data: opts.outputData } : {}),
            ...(opts?.errorMessage !== undefined
              ? { error_message: opts.errorMessage }
              : status === 'running'
                ? { error_message: null }
                : {}),
            ...(opts?.provider !== undefined ? { provider: opts.provider } : {}),
            fallback_used: opts?.fallback_used ?? base.fallback_used ?? false,
            ...(opts?.primary_provider_error !== undefined
              ? { primary_provider_error: opts.primary_provider_error }
              : {}),
          }
          byStep.set(stepName, nextRow)
          const ordered = new Set<string>(STEP_ORDER as unknown as string[])
          const merged = STEP_ORDER.map((name) => {
            const t = byStep.get(name)
            return (
              t ?? {
                step_name: name,
                status: 'pending' as const,
                output_data: null,
                error_message: null,
                started_at: null,
                completed_at: null,
                provider: null,
                fallback_used: false,
                primary_provider_error: null,
              }
            )
          })
          const extras = prev.filter((t) => !ordered.has(t.step_name))
          return { analysisTasks: extras.length ? [...merged, ...extras] : merged }
        })
      },

      isAnalyzingNow: () => {
        const state = get()
        return isAnalyzing(state.streamingState)
      },

      abortAnalysis: () => {
        if (currentAbortController) {
          currentAbortController.abort()
          currentAbortController = null
        }
        const state = get()
        const lastStep = state.streamingState.status === 'running' || state.streamingState.status === 'streaming'
          ? state.streamingState.currentStep
          : null
        set({
          status: 'idle',
          analysisStatus: 'queued',
          streamingState: createErrorState('사용자에 의해 취소됨', lastStep),
          error: '분석이 취소되었습니다.',
        })
        toast.info('분석이 취소되었습니다.')
      },

      recoverFromError: () => {
        const state = get()
        const lastReport = state.lastSuccessfulReport
        if (!lastReport?.reportId) {
          toast.warning('복구할 수 있는 이전 리포트가 없습니다.')
          return false
        }
        set({
          result: lastReport,
          status: 'done',
          analysisStatus: 'completed',
          streamingState: createCompletedState(lastReport.reportId ?? null),
          error: null,
        })
        toast.success('이전 리포트로 복구되었습니다.')
        return true
      },

      applyStreamingUpdate: (payload: StreamingUpdatePayload) => {
        const state = get()
        const prevSummary = state.summarySection
        const prevMarket = state.marketTemperatureSection
        const prevActions = state.recommendedActionsSection
        const prevInsights = state.insightsSection

        const trend: 'rising' | 'stable' | 'declining' =
          typeof payload.temperature === 'number'
            ? payload.temperature > 50
              ? 'rising'
              : payload.temperature < 50
                ? 'declining'
                : 'stable'
            : prevMarket?.trend ?? 'stable'

        const summarySection: SummarySection | null =
          payload.summary != null || payload.reportId != null || payload.newsList
            ? {
                summaryText: payload.summary ?? prevSummary?.summaryText ?? '',
                trend: prevSummary?.trend ?? trend,
                confidence: prevSummary?.confidence ?? null,
                analysis_target: prevSummary?.analysis_target ?? null,
                updated_at: payload.reportId ? new Date().toISOString() : prevSummary?.updated_at ?? null,
                reportId: payload.reportId ?? prevSummary?.reportId ?? null,
                keyConclusions: payload.insightLines?.length ? payload.insightLines.slice(0, 5) : prevSummary?.keyConclusions ?? [],
                marketNews: payload.insightLines?.length ? payload.insightLines.slice(0, 5) : prevSummary?.marketNews ?? [],
                painPoints: prevSummary?.painPoints ?? [],
                competitorTrends: prevSummary?.competitorTrends ?? '',
                sentiment: typeof payload.temperature === 'number' ? payload.temperature : prevSummary?.sentiment ?? null,
                chartData: prevSummary?.chartData ?? null,
                source_links: payload.newsList ?? prevSummary?.source_links ?? [],
                analysis_groq: prevSummary?.analysis_groq,
                analysis_gemini: prevSummary?.analysis_gemini,
                analysis_results: prevSummary?.analysis_results,
              }
            : prevSummary

        const marketTemperatureSection: MarketTemperatureSection | null =
          typeof payload.temperature === 'number'
            ? {
                score: payload.temperature,
                trend,
                positiveSignals: prevMarket?.positiveSignals ?? [],
                neutralSignals: prevMarket?.neutralSignals ?? [],
                negativeRisks: prevMarket?.negativeRisks ?? [],
              }
            : prevMarket

        const insightsSection: InsightsSection | null =
          payload.insightLines?.length
            ? (() => {
                const lines = payload.insightLines
                const facts = lines.filter((l) => /^(fact|사실)/i.test(l) || !/^(hypothesis|가설|inference|추론)/i.test(l))
                const hypotheses = lines.filter((l) => /^(hypothesis|가설)/i.test(l))
                const inferences = lines.filter((l) => /^(inference|추론)/i.test(l))
                return {
                  facts: facts.length ? facts : lines.slice(0, 5),
                  hypotheses: hypotheses.length ? hypotheses : [],
                  inferences: inferences.length ? inferences : [],
                }
              })()
            : payload.appendInsight != null
              ? (() => {
                  const prev = prevInsights ?? { facts: [], hypotheses: [], inferences: [] }
                  const merged = [...prev.facts, ...prev.hypotheses, ...prev.inferences]
                  if (!merged.includes(payload.appendInsight!)) merged.push(payload.appendInsight!)
                  const facts = merged.filter((l) => /^(fact|사실)/i.test(l) || !/^(hypothesis|가설|inference|추론)/i.test(l))
                  const hypotheses = merged.filter((l) => /^(hypothesis|가설)/i.test(l))
                  const inferences = merged.filter((l) => /^(inference|추론)/i.test(l))
                  return {
                    facts: facts.length ? facts : merged.slice(0, 5),
                    hypotheses: hypotheses.length ? hypotheses : [],
                    inferences: inferences.length ? inferences : [],
                  }
                })()
              : prevInsights

        const recommendedActionsSection: RecommendedActionsSection | null =
          payload.actionLines?.length
            ? {
                actions: payload.actionLines.map((a) => ({
                  title: a.title,
                  reasoning: a.reasoning,
                  urgency_level: a.urgency,
                })),
                monitoring_points: prevActions?.monitoring_points ?? [],
              }
            : payload.appendAction != null
              ? {
                  actions: [...(prevActions?.actions ?? []), {
                    title: payload.appendAction.title,
                    reasoning: payload.appendAction.reasoning,
                    urgency_level: payload.appendAction.urgency,
                  }],
                  monitoring_points: prevActions?.monitoring_points ?? [],
                }
              : prevActions

        let result = composeResultFromSections(
          summarySection,
          marketTemperatureSection,
          recommendedActionsSection,
          insightsSection,
          state.result
        )
        if (result && (payload.reportId != null || payload.analysis_depth != null || payload.serper_used != null)) {
          result = {
            ...result,
            reportId: payload.reportId ?? result.reportId,
            analysis_depth: payload.analysis_depth ?? result.analysis_depth,
            serper_used: payload.serper_used ?? result.serper_used,
          }
        }

        set({
          summarySection,
          marketTemperatureSection,
          recommendedActionsSection,
          insightsSection,
          result,
          newsList: payload.newsList ?? state.newsList,
          ...(payload.reportId ? { status: 'done' as const, analysisStatus: 'completed' as const, error: null } : {}),
          ...(payload.error ? { status: 'error' as const, analysisStatus: 'failed' as const, error: payload.error } : {}),
        })
      },

      startStreamingResearch: async (
        keyword: string,
        options?: {
          country_code?: string
          mode?: AnalysisMode
          ai_primary_model?: 'gemini' | 'groq'
          force_reanalyze?: boolean
          rerun_from_phase?: 1 | 2 | 3
          retry_pipeline_step?: 'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity'
        }
      ) => {
        const k = keyword?.trim()
        if (!k) {
          toast.error('검색어가 없습니다.')
          set({ status: 'error', error: '검색어가 없습니다.' })
          return
        }

        const countryCode = options?.country_code ?? 'KR'

        const resetServerAnalyzingRow = async () => {
          try {
            await fetch('/api/research/reset-analyzing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ keyword: k, country_code: countryCode }),
            })
          } catch {
            /* ignore — 재시도는 클라이언트 잠금 해제로 가능 */
          }
        }

        // Prevent duplicate runs. 재분석·단계 재실행은 이전 요청을 중단하고 잠금을 풀고 진행합니다.
        if (get().isAnalyzingNow()) {
          const allowBreakStaleClientLock =
            options?.force_reanalyze === true ||
            options?.rerun_from_phase === 1 ||
            options?.rerun_from_phase === 2 ||
            options?.rerun_from_phase === 3 ||
            !!options?.retry_pipeline_step
          if (allowBreakStaleClientLock) {
            if (currentAbortController) {
              currentAbortController.abort()
              currentAbortController = null
            }
            set({
              streamingState: createIdleState(),
              status: 'idle',
              analysisStatus: 'queued',
              error: null,
            })
            await resetServerAnalyzingRow()
          } else {
            toast.warning('이미 분석이 진행 중입니다.')
            return
          }
        }

        // Abort any previous request (새 실행 직전)
        if (currentAbortController) {
          currentAbortController.abort()
        }
        currentAbortController = new AbortController()
        const signal = currentAbortController.signal

        const modeFromStorage =
          typeof window !== 'undefined'
            ? (() => {
                const s = window.localStorage.getItem('rin_analysis_depth')
                return s === 'fast' ? 'quick' : s === 'deep' ? 'deep' : 'standard'
              })()
            : 'standard'
        const mode = options?.mode ?? modeFromStorage ?? get().analysisMode
        const steps = ANALYSIS_MODE_STEPS[mode]
        const retryPipelineStep = options?.retry_pipeline_step
        const RETRY_STEP_INDEX: Record<
          'insight_extraction' | 'strategy_generation' | 'execution_layer' | 'risk_opportunity',
          number
        > = {
          insight_extraction: 5,
          strategy_generation: 6,
          execution_layer: 7,
          risk_opportunity: 8,
        }
        const startStepIdx = retryPipelineStep ? RETRY_STEP_INDEX[retryPipelineStep] : 0
        const startStepId = retryPipelineStep ?? steps[0]?.id ?? 'signal_layer'
        const preserveForStepRetry = !!retryPipelineStep
        const snap = get()

        // Preserve last successful report for recovery
        const prevResult = snap.result
        if (prevResult?.reportId) {
          set({ lastSuccessfulReport: prevResult })
        }

        set({
          keyword: k,
          analysisCountryCode: countryCode,
          status: 'loading',
          analysisStatus: 'analyzing',
          analysisMode: mode,
          pipelineServedFromServerCache: false,
          streamingState: createRunningState(mode, startStepIdx, startStepId),
          currentStep: startStepIdx,
          totalSteps: getStepCount(mode),
          newsList: preserveForStepRetry ? snap.newsList : [],
          result: preserveForStepRetry ? snap.result : null,
          summarySection: preserveForStepRetry ? snap.summarySection : null,
          marketTemperatureSection: preserveForStepRetry ? snap.marketTemperatureSection : null,
          recommendedActionsSection: preserveForStepRetry ? snap.recommendedActionsSection : null,
          insightsSection: preserveForStepRetry ? snap.insightsSection : null,
          error: null,
          insights: preserveForStepRetry ? snap.insights : null,
          taskData: preserveForStepRetry ? snap.taskData : {},
          analysisId: preserveForStepRetry ? snap.analysisId : null,
          analysisTasks: preserveForStepRetry ? snap.analysisTasks : null,
          streamingActivityLog: [],
          liveInsightSuggestion: null,
          liveInsightSuggestionLoading: false,
        })

        if (retryPipelineStep) {
          get().mergeStreamingTaskIntoAnalysisTasks(retryPipelineStep, 'running', {})
        }

        const appendActivity = (message: string, kind?: 'error', stepIdRaw?: string) => {
          const stepId = stepIdRaw ? normalizeActivityStepId(stepIdRaw) : undefined
          set((state) => ({
            streamingActivityLog: [
              ...state.streamingActivityLog.slice(-149),
              {
                ts: Date.now(),
                message,
                ...(kind === 'error' ? { kind: 'error' as const, type: 'error' as const } : {}),
                ...(stepId ? { stepId } : {}),
              },
            ],
          }))
        }

        try {
          const checkRes = await fetch('/api/settings', { credentials: 'same-origin', signal })
          if (checkRes.ok) {
            const checkData = (await checkRes.json()) as { canSearch?: boolean }
            if (checkData.canSearch === false) {
              const apiKeyMsg = '설정에서 API 키를 등록한 뒤 분석을 사용할 수 있습니다.'
              appendActivity(apiKeyMsg, 'error', '__global__')
              toast.error('설정 → API KEY에서 필요한 키를 입력해 주세요. (Gemini 우선이면 Gemini, Groq 우선이면 Groq)')
              set({
                status: 'error',
                analysisStatus: 'failed',
                streamingState: createErrorState('API 키가 설정되지 않았습니다.', null),
                error: apiKeyMsg,
              })
              return
            }
          }

          await resetServerAnalyzingRow()

          const buildPipelineTaskSnapshot = (): Array<{
            step_name: string
            status: string
            output_data: unknown
          }> => {
            const snap = get()
            const hasPayload = (o: unknown) =>
              o != null && typeof o === 'object' && Object.keys(o as object).length > 0
            const fromLive =
              snap.analysisTasks
                ?.filter((t) => t.status === 'completed' && hasPayload(t.output_data))
                .map((t) => ({
                  step_name: t.step_name,
                  status: 'completed' as const,
                  output_data: t.output_data,
                })) ?? []
            const cached = snap.analysisId ? readPipelineClientCache(snap.analysisId) : null
            const byStep = new Map<string, { step_name: string; status: string; output_data: unknown }>()
            for (const r of cached?.tasks ?? []) {
              if (r.status === 'completed' && hasPayload(r.output_data)) {
                byStep.set(r.step_name, {
                  step_name: r.step_name,
                  status: 'completed',
                  output_data: r.output_data,
                })
              }
            }
            for (const r of fromLive) {
              byStep.set(r.step_name, r)
            }
            return Array.from(byStep.values())
          }

          const pipelineTaskSnapshot =
            options?.retry_pipeline_step ? buildPipelineTaskSnapshot() : undefined

          const res = await fetch('/api/research/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: k,
              country_code: countryCode,
              mode,
              ai_primary_model: options?.ai_primary_model,
              force_reanalyze:
                options?.force_reanalyze === true || options?.rerun_from_phase === 1,
              rerun_from_phase:
                options?.rerun_from_phase === 2 || options?.rerun_from_phase === 3
                  ? options.rerun_from_phase
                  : undefined,
              retry_pipeline_step: options?.retry_pipeline_step,
              ...(pipelineTaskSnapshot && pipelineTaskSnapshot.length > 0
                ? { pipeline_task_snapshot: pipelineTaskSnapshot }
                : {}),
            }),
            credentials: 'same-origin',
            signal,
          })

          if (!res.ok) {
            const errData = (await res.json().catch(() => ({}))) as { error?: string }
            const msg = errData.error ?? '분석 요청에 실패했어요.'
            appendActivity(msg, 'error', '__global__')
            set({
              status: 'error',
              analysisStatus: 'failed',
              streamingState: createErrorState(msg, null),
              error: msg,
            })
            toast.error(msg)
            return
          }

          const reader = res.body?.getReader()
          if (!reader) {
            appendActivity('스트림을 읽을 수 없습니다.', 'error', '__global__')
            set({
              status: 'error',
              analysisStatus: 'failed',
              streamingState: createErrorState('스트림을 읽을 수 없습니다.', null),
              error: '스트림을 읽을 수 없습니다.',
            })
            return
          }

          const decoder = new TextDecoder()
          let buffer = ''
          let streamEnded = false
          let lastSuccessfulStep = 0
          appendActivity('분석 파이프라인에 연결되었습니다. 단계별 진행 상황을 표시합니다.', undefined, 'signal_layer')
          const applyUpdate = get().applyStreamingUpdate
          const setStepProgress = get().setStepProgress
          const setAnalysisId = get().setAnalysisId
          /** `done` 이벤트 수신 시 스트림 종료 후 DB에서 key_metrics·차트 등 전체 리포트 로드 */
          let shouldHydrateFromHistoryAfterDone = false

          // Product Strategy Engine - 5 layers + post_processing (6)
          const stepMap: Record<string, number> = {
            analysis_prep: 0,
            signal_layer: 1,
            news: 1,
            article_extraction: 2,
            article_summary: 2,
            trend_analysis: 3,
            pass1: 3,
            competition_analysis: 4,
            insight_extraction: 5,
            strategy_generation: 6,
            execution_layer: 7,
            pass2: 7,
            creative: 7,
            risk_opportunity: 8,
            post_processing: 8,
            post_processing_key_metrics: 8,
            post_processing_creative: 8,
            post_processing_saving: 8,
          }

          while (!streamEnded) {
            // Check for abort
            if (signal.aborted) {
              streamEnded = true
              break
            }

            const { done, value } = await reader.read()
            if (done) streamEnded = true
            else buffer += decoder.decode(value, { stream: true })

            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              const trimmed = line.trim()
              if (!trimmed) continue
              try {
                if (trimmed.length > 100_000) throw new Error('Event too long')
                const first = trimmed[0]
                if (first !== '{' && first !== '[') throw new Error('Invalid event format')
                const event = JSON.parse(trimmed) as {
                  type: string
                  items?: Array<{ title: string; url: string; publisher?: string }>
                  summary?: string
                  temperature?: number
                  insights?: string[]
                  structured?: {
                    market_temperature_score?: number
                    summary_insights?: string
                    facts?: string[]
                    hypotheses?: string[]
                    inferences?: string[]
                    positive_signals?: string[]
                    neutral_signals?: string[]
                    negative_risks?: string[]
                    pm_actions?: {
                      recommended_actions?: Array<{ title: string; reasoning?: string; urgency_level?: string }>
                      monitoring_points?: string[]
                    }
                  }
                  groqText?: string | null
                  geminiText?: string | null
                  reportId?: string
                  sourceLinks?: Array<{ title: string; url: string; publisher?: string }>
                  message?: string
                }
                if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('Invalid event')
                const type = typeof event.type === 'string' ? event.type : ''

                if (type === 'analysis_started') {
                  const ev = event as { analysisId?: string }
                  if (ev.analysisId) setAnalysisId(ev.analysisId)
                  if (!retryPipelineStep) {
                    setStepProgress(0, 'analysis_prep')
                  }
                  appendActivity('데이터 수집·AI 분석을 시작합니다.', undefined, 'signal_layer')
                }

                if (type === 'pipeline_resume') {
                  const ev = event as { message?: string; phase?: number; skippedSteps?: string[] }
                  appendActivity(
                    ev.message ??
                      `저장된 결과에서 이어 실행합니다 (단계 ${ev.phase ?? '?'})`,
                    undefined,
                    '__global__'
                  )
                }

                if (type === 'quota_backoff') {
                  const ev = event as { message?: string; waitMs?: number; step?: string; attempt?: number }
                  const msg =
                    typeof ev.message === 'string' && ev.message.trim()
                      ? ev.message.trim()
                      : `API 한도로 ${Math.ceil((ev.waitMs ?? 8000) / 1000)}초 대기 후 재시도합니다.`
                  appendActivity(msg, undefined, typeof ev.step === 'string' ? ev.step : '__global__')
                  toast.info(msg, { duration: Math.min(12_000, Math.max(4000, (ev.waitMs ?? 8000) + 2000)) })
                }

                if (type === 'article_summary_quality_notice') {
                  const ev = event as { message?: string }
                  const msg =
                    typeof ev.message === 'string' && ev.message.trim()
                      ? ev.message.trim()
                      : '무료 한도 초과 → 요약 품질이 낮을 수 있습니다. (본문 발췌를 사용합니다.)'
                  appendActivity(msg, undefined, 'article_summary')
                  toast.info(msg, { id: 'article-summary-quality-notice', duration: 10_000 })
                }

                if (type === 'final_refining') {
                  const ev = event as { phase?: number; message?: string }
                  const phase =
                    ev.phase === 1 || ev.phase === 2 || ev.phase === 3 ? ev.phase : 1
                  const msg = typeof ev.message === 'string' ? ev.message : ''
                  if (msg) appendActivity(msg, undefined, 'post_processing')
                  setStepProgress(8, 'final_refining', undefined, undefined, {
                    refiningPhase: phase,
                    refiningMessage: msg || undefined,
                  })
                }

                // Handle task events (AI Analysis Console)
                if (type === 'task') {
                  const ev = event as {
                    task?: string
                    status?: string
                    data?: unknown
                    error?: string
                    fallbackMessage?: string
                    retryMessage?: string
                    provider?: string | null
                    fallback_used?: boolean
                    primaryProviderError?: string
                    currentArticleTitle?: string
                    progressMeta?: AnalysisProgressMeta
                  }
                  const task = ev.task
                  const status = ev.status
                  const evPm = ev.progressMeta
                  if (task && task in stepMap) {
                    const stepIdx = stepMap[task]
                    setStepProgress(stepIdx, task, ev.retryMessage, ev.currentArticleTitle, evPm)
                    if (task && status === 'running') {
                      appendActivity(
                        getAnalysisActivityMessage(task, undefined, {
                          currentArticleTitle: ev.currentArticleTitle,
                          progressMeta: evPm,
                        }),
                        undefined,
                        task
                      )
                    }
                    if (task === 'signal_layer' && status === 'completed' && evPm?.newsCount != null) {
                      appendActivity(
                        getAnalysisActivityMessage('signal_layer', undefined, {
                          progressMeta: evPm,
                        }),
                        undefined,
                        'signal_layer'
                      )
                    }
                    if (status === 'completed') {
                      lastSuccessfulStep = Math.max(lastSuccessfulStep, stepIdx)
                      if (ev.data != null) {
                        get().setTaskData(task, ev.data)
                      }
                      get().mergeStreamingTaskIntoAnalysisTasks(task, 'completed', {
                        outputData: ev.data ?? null,
                        provider: ev.provider ?? null,
                        fallback_used: ev.fallback_used ?? false,
                        primary_provider_error: ev.primaryProviderError ?? null,
                      })
                      if (task === 'strategy_generation' && ev.data != null) {
                        const three = threeLinesFromStrategyTaskOutput(ev.data)
                        const d = ev.data as Record<string, unknown>
                        const bg = typeof d.background_rationale === 'string' ? d.background_rationale.trim() : ''
                        if ((three?.length ?? 0) > 0 || bg) {
                          set((s) => {
                            const prev = s.result
                            if (!prev) return {}
                            const km = { ...(prev.key_metrics ?? {}) }
                            if (three?.length) km.conclusion_three_lines = three
                            if (bg) km.background_rationale = bg
                            const ss = typeof d.strategy_summary === 'string' ? d.strategy_summary.trim() : ''
                            if (ss) km.summary_insights = ss
                            return { result: { ...prev, key_metrics: km } }
                          })
                        }
                      }
                      const after = get()
                      if (after.analysisId && after.analysisTasks) {
                        writePipelineClientCache(after.analysisId, after.analysisTasks, after.taskData)
                      }
                    } else if (status === 'running') {
                      get().mergeStreamingTaskIntoAnalysisTasks(task, 'running', {
                        provider: ev.provider ?? null,
                        fallback_used: ev.fallback_used ?? false,
                        primary_provider_error: ev.primaryProviderError ?? null,
                      })
                    } else if (status === 'failed') {
                      get().mergeStreamingTaskIntoAnalysisTasks(task, 'failed', {
                        errorMessage: ev.fallbackMessage ?? ev.error ?? null,
                        provider: ev.provider ?? null,
                        fallback_used: ev.fallback_used ?? false,
                      })
                      appendActivity(`${task}: ${ev.fallbackMessage ?? ev.error ?? '단계 실패'}`, 'error', task)
                    }
                  }
                }

                // Update step progress for non-task events
                if (type !== 'task' && type in stepMap) {
                  const stepIdx = stepMap[type]
                  setStepProgress(stepIdx, type)
                  lastSuccessfulStep = stepIdx
                }

                if (type === 'post_processing') {
                  const ev = event as { stepId?: string }
                  const stepId = ev.stepId ?? 'key_metrics'
                  const mapped = `post_processing_${stepId}`
                  if (mapped in stepMap) {
                    setStepProgress(stepMap[mapped], mapped)
                  }
                }

                if (type === 'news') {
                  const newsList = (event.items ?? []).map((n) => ({
                    title: n.title,
                    url: n.url,
                    publisher: n.publisher,
                  }))
                  set({ newsList })
                } else if (type === 'pass1') {
                  applyUpdate({
                    summary: event.summary ?? '',
                    temperature: event.temperature ?? 50,
                    insightLines: event.insights ?? [],
                  })
                } else if (type === 'pass2') {
                  const s = event.structured
                  if (s) {
                    const actionLines = (s.pm_actions?.recommended_actions ?? []).map((a) => ({
                      title: a.title,
                      reasoning: a.reasoning ?? '',
                      urgency: (a.urgency_level === 'high' || a.urgency_level === 'medium' ? a.urgency_level : 'low') as 'low' | 'medium' | 'high',
                    }))
                    applyUpdate({
                      temperature: s.market_temperature_score ?? get().marketTemperatureSection?.score ?? 50,
                      insightLines: [...(s.facts ?? []), ...(s.hypotheses ?? []), ...(s.inferences ?? [])],
                      actionLines,
                    })
                  }
                } else if (type === 'creative') {
                  // Creative analysis updates analysis_groq/analysis_gemini - handled by loadFromHistory after done
                } else if (type === 'done') {
                  const newsList = (event.sourceLinks ?? []).map((l) => ({
                    title: l.title ?? '',
                    url: l.url ?? '',
                    publisher: l.publisher,
                  }))
                  const depth = (event as { analysis_depth?: 'fast' | 'standard' | 'deep' }).analysis_depth
                  const serperUsed = (event as { serper_used?: boolean }).serper_used
                  applyUpdate({
                    reportId: event.reportId ?? null,
                    newsList: newsList.length ? newsList : undefined,
                    analysis_depth: depth ?? undefined,
                    serper_used: serperUsed,
                  })
                  set({
                    streamingState: createCompletedState(event.reportId ?? null),
                    pipelineServedFromServerCache: false,
                  })
                  shouldHydrateFromHistoryAfterDone = true
                  streamEnded = true
                  break
                } else if (type === 'cached') {
                  set({
                    status: 'done',
                    analysisStatus: 'completed',
                    streamingState: createCompletedState(null),
                    error: null,
                    pipelineServedFromServerCache: true,
                  })
                  await get().loadFromHistory(k, countryCode)
                  streamEnded = true
                  break
                } else if (type === 'error') {
                  const errMsg = event.message ?? '분석 중 오류가 발생했습니다.'
                  appendActivity(errMsg, 'error', '__global__')
                  set({
                    streamingState: createErrorState(errMsg, lastSuccessfulStep),
                    status: 'error',
                    analysisStatus: 'failed',
                    error: errMsg,
                  })
                  applyUpdate({ error: errMsg })
                  streamEnded = true
                  break
                }
              } catch {
                const errMsg = '잘못된 응답 형식입니다.'
                appendActivity(errMsg, 'error', '__global__')
                set({
                  streamingState: createErrorState(errMsg, lastSuccessfulStep),
                  status: 'error',
                  analysisStatus: 'failed',
                  error: errMsg,
                })
                applyUpdate({ error: errMsg })
                streamEnded = true
                break
              }
            }
          }

          if (buffer.trim() && !signal.aborted) {
            try {
              const buf = buffer.trim()
              if (buf.length > 100_000) throw new Error('Event too long')
              if (buf[0] !== '{' && buf[0] !== '[') throw new Error('Invalid event format')
              const event = JSON.parse(buf) as { type?: string; reportId?: string; message?: string; sourceLinks?: Array<{ title?: string; url?: string; publisher?: string }>; analysis_depth?: 'fast' | 'standard' | 'deep'; serper_used?: boolean }
              if (!event || typeof event !== 'object') throw new Error('Invalid event')
              if (event?.type === 'done') {
                const newsList = (event.sourceLinks ?? []).map((l) => ({
                  title: l.title ?? '',
                  url: l.url ?? '',
                  publisher: l.publisher,
                }))
                const depth = (event as { analysis_depth?: 'fast' | 'standard' | 'deep' }).analysis_depth
                const serperUsed = (event as { serper_used?: boolean }).serper_used
                applyUpdate({
                  reportId: event.reportId ?? null,
                  newsList: newsList.length ? newsList : undefined,
                  analysis_depth: depth ?? undefined,
                  serper_used: serperUsed,
                })
                set({
                  streamingState: createCompletedState(event.reportId ?? null),
                  pipelineServedFromServerCache: false,
                })
                shouldHydrateFromHistoryAfterDone = true
              } else if (event?.type === 'error') {
                const errMsg = event.message ?? '분석 중 오류가 발생했습니다.'
                set({
                  streamingState: createErrorState(errMsg, lastSuccessfulStep),
                  status: 'error',
                  analysisStatus: 'failed',
                  error: errMsg,
                })
                applyUpdate({ error: errMsg })
              }
            } catch {
              const errMsg = '잘못된 응답 형식입니다.'
              set({
                streamingState: createErrorState(errMsg, lastSuccessfulStep),
                status: 'error',
                analysisStatus: 'failed',
                error: errMsg,
              })
              get().applyStreamingUpdate({ error: errMsg })
            }
          }

          if (isAnalyzing(get().streamingState)) {
            const errMsg = signal.aborted
              ? '분석이 중단되었습니다.'
              : '분석 스트림이 비정상적으로 종료되었습니다. 다시 시도해 주세요.'
            set({
              status: 'error',
              analysisStatus: 'failed',
              streamingState: createErrorState(errMsg, lastSuccessfulStep),
              error: errMsg,
            })
            if (!signal.aborted) {
              toast.error(errMsg)
            }
          }

          if (shouldHydrateFromHistoryAfterDone) {
            await get().loadFromHistory(k, countryCode)
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') {
            if (get().isAnalyzingNow()) {
              const st = get().streamingState
              const lastStep =
                st.status === 'streaming' || st.status === 'running' ? st.currentStep : null
              set({
                status: 'error',
                analysisStatus: 'failed',
                streamingState: createErrorState('분석 요청이 취소되었습니다.', lastStep),
                error: '분석 요청이 취소되었습니다.',
              })
            }
            return
          }
          const msg = (err as Error)?.message ?? '분석을 시작하지 못했어요.'
          showErrorToast(err, { fallbackMessage: msg })
          set({
            status: 'error',
            analysisStatus: 'failed',
            streamingState: createErrorState(msg, null),
            error: msg,
          })
        } finally {
          currentAbortController = null
          const ss = get().streamingState
          if (ss.status === 'running' || ss.status === 'streaming') {
            set({
              streamingState: createErrorState(
                '분석 연결이 비정상적으로 종료되었습니다. 다시 시도해 주세요.',
                null
              ),
              status: 'error',
              analysisStatus: 'failed',
              error: '분석 연결이 비정상적으로 종료되었습니다. 다시 시도해 주세요.',
            })
          }
        }
      },

      refreshLiveInsightSuggestion: async () => {
        const st = get()
        const body = buildInsightSuggestionRequestBody({
          keyword: st.keyword,
          countryCode: st.analysisCountryCode ?? 'KR',
          result: st.result,
          taskData: st.taskData,
          newsList: st.newsList,
        })
        if (!body) {
          set({ liveInsightSuggestion: null, liveInsightSuggestionLoading: false })
          return
        }
        set({ liveInsightSuggestionLoading: true })
        try {
          const res = await fetch('/api/research/insight-suggestion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(body),
          })
          const json = (await res.json()) as InsightSuggestionResult & { error?: string }
          if (!res.ok || typeof json?.rationale_one_liner !== 'string' || !json.rationale_one_liner.trim()) {
            set({ liveInsightSuggestion: null, liveInsightSuggestionLoading: false })
            return
          }
          set({ liveInsightSuggestion: json as InsightSuggestionResult, liveInsightSuggestionLoading: false })
        } catch {
          set({ liveInsightSuggestion: null, liveInsightSuggestionLoading: false })
        }
      },

      loadFromHistory: async (keyword: string, countryCode = 'KR') => {
        const k = keyword?.trim()
        if (!k) return 'none'
        try {
          const res = await fetch(`/api/research/history?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(countryCode)}`)
          const raw = await res.json().catch(() => ({}))
          const data = typeof raw === 'object' && raw != null ? (raw as {
            cached?: boolean
            emptyAnalysis?: boolean
            reportId?: string
            keyword?: string
            analysis_depth?: 'fast' | 'standard' | 'deep' | null
            serper_used?: boolean
            content?: Record<string, unknown>
            source_links?: Array<{ title?: string; url?: string }>
            ai_responses?: Record<string, string>
            key_metrics?: unknown
            updated_at?: string
            analysis_groq?: { summary: string; modelName: string }
            analysis_gemini?: Record<string, string>
            analysis_results?: { summary?: string; sentiment?: number; strategic_insight?: string; action_item?: string; confidence?: number }
            pipeline_analysis_id?: string
            pipeline_tasks?: Array<{
              step_name: string
              status: 'pending' | 'running' | 'completed' | 'failed'
              output_data: unknown
              error_message: string | null
              provider?: string | null
              fallback_used?: boolean
              primary_provider_error?: string | null
            }>
          }) : {}
          if (!res.ok) {
            if (res.status === 401) return 'none'
            return 'error'
          }
          if (!data.cached) return 'none'
          if (data.emptyAnalysis) return 'empty'
          const ar = parseJsonField(data.analysis_results) as ResearchResponse['analysis_results']
          const km = parseJsonField(data.key_metrics) as ResearchResponse['key_metrics']
          const pipelineTasksEarly = Array.isArray(data.pipeline_tasks) ? data.pipeline_tasks : null
          const rawAnalysisStatus = (data as { analysis_status?: string }).analysis_status
          const apiAnalysisStatus: CanonicalAnalysisStatus | undefined =
            rawAnalysisStatus === 'completed' ||
            rawAnalysisStatus === 'failed' ||
            rawAnalysisStatus === 'analyzing' ||
            rawAnalysisStatus === 'queued'
              ? rawAnalysisStatus
              : undefined
          let analysisStatus: CanonicalAnalysisStatus = apiAnalysisStatus ?? 'completed'
          if (
            apiAnalysisStatus == null &&
            pipelineTasksEarly?.some((t) => t.status === 'failed')
          ) {
            analysisStatus = 'failed'
          }
          if (data.reportId) {
            const pipelineTasks = pipelineTasksEarly
            const taskDataFromPipeline: Partial<Record<string, unknown>> = {}
            if (pipelineTasks && pipelineTasks.length > 0) {
              for (const t of pipelineTasks) {
                if (t.status === 'completed' && t.output_data != null && typeof t.step_name === 'string') {
                  taskDataFromPipeline[t.step_name] = t.output_data
                }
              }
            }
            const kmForStore = enrichKeyMetricsFromPipelineTaskData(km, taskDataFromPipeline) ?? km

            const statusFromBackend =
              analysisStatus === 'completed' ? 'done' as const
              : analysisStatus === 'failed' ? 'error' as const
              : analysisStatus === 'analyzing' || analysisStatus === 'queued' ? 'loading' as const
              : 'done' as const
            const rawContent = data.content
            const content = (typeof rawContent === 'object' && rawContent != null && !Array.isArray(rawContent))
              ? (rawContent as Record<string, unknown>)
              : {}
            const trend = (ar?.sentiment != null && ar.sentiment > 0) ? 'rising' as const : (ar?.sentiment != null && ar.sentiment < 0) ? 'declining' as const : 'stable' as const
            const summarySection: SummarySection = {
              summaryText: (km?.summary_insights ?? (Array.isArray(km?.keyConclusions) ? km.keyConclusions[0] : '') ?? '') as string,
              trend,
              confidence: typeof km?.confidence_score === 'number' ? km.confidence_score : null,
              analysis_target: (km?.analysis_target as string) ?? null,
              updated_at: data.updated_at ?? null,
              reportId: data.reportId,
              keyConclusions: (km?.keyConclusions ?? []) as string[],
              marketNews: Array.isArray(content.marketNews) ? (content.marketNews as string[]) : [],
              painPoints: Array.isArray(content.painPoints) ? (content.painPoints as string[]) : [],
              competitorTrends: typeof content.competitorTrends === 'string' ? content.competitorTrends : '',
              sentiment: (km?.sentiment ?? content.sentiment) as number | null,
              chartData: (km?.chartData ?? content.chartData) as ChartData | null,
              source_links: data.source_links ?? [],
              analysis_groq: data.analysis_groq,
              analysis_gemini: data.analysis_gemini,
              analysis_results: ar,
            }
            const marketTemperatureSection: MarketTemperatureSection = {
              score: typeof km?.market_temperature_score === 'number' ? km.market_temperature_score : (typeof km?.sentiment === 'number' ? km.sentiment : 50),
              trend,
              positiveSignals: (km?.positive_signals ?? []) as string[],
              neutralSignals: (km?.neutral_signals ?? []) as string[],
              negativeRisks: (km?.negative_risks ?? []) as string[],
            }
            const pa = kmForStore?.pm_actions
            const recommendedActionsSection: RecommendedActionsSection = {
              actions: (pa?.recommended_actions ?? []).map((a: unknown) => typeof a === 'object' && a != null && typeof (a as { title?: string }).title === 'string' ? { title: (a as { title: string }).title, reasoning: (a as { reasoning?: string }).reasoning, urgency_level: (a as { urgency_level?: string }).urgency_level as 'low' | 'medium' | 'high' | undefined, related_risk: (a as { related_risk?: string }).related_risk } : { title: String(a) }),
              monitoring_points: (pa?.monitoring_points ?? []) as string[],
            }
            const insightsSection: InsightsSection = {
              facts: (km?.facts ?? []) as string[],
              hypotheses: (km?.hypotheses ?? []) as string[],
              inferences: (km?.inferences ?? []) as string[],
            }
            const fullResult: ResearchResponse = {
              ...content,
              marketNews: Array.isArray(content.marketNews) ? content.marketNews : (summarySection.marketNews ?? []),
              painPoints: Array.isArray(content.painPoints) ? content.painPoints : (summarySection.painPoints ?? []),
              competitorTrends: typeof content.competitorTrends === 'string' ? content.competitorTrends : (summarySection.competitorTrends ?? ''),
              reportId: data.reportId,
              analysis_depth: data.analysis_depth ?? undefined,
              serper_used: data.serper_used === true,
              ai_responses: (data.ai_responses && typeof data.ai_responses === 'object') ? data.ai_responses : {},
              source_links: Array.isArray(data.source_links) ? data.source_links : [],
              updated_at: data.updated_at ?? undefined,
              analysis_groq: (data.analysis_groq && typeof data.analysis_groq === 'object') ? data.analysis_groq : undefined,
              analysis_gemini: (data.analysis_gemini && typeof data.analysis_gemini === 'object') ? data.analysis_gemini : undefined,
              analysis_results: ar,
              key_metrics: kmForStore,
            } as ResearchResponse
            const pipelineAnalysisId =
              typeof data.pipeline_analysis_id === 'string' && data.pipeline_analysis_id.length > 0
                ? data.pipeline_analysis_id
                : null
            const normalizedPipelineTasks =
              pipelineTasks && pipelineTasks.length > 0
                ? pipelineTasks.map((t) => ({
                    step_name: t.step_name,
                    status: t.status,
                    output_data: t.output_data,
                    error_message: t.error_message,
                    provider: t.provider ?? null,
                    fallback_used: t.fallback_used ?? false,
                    primary_provider_error: t.primary_provider_error ?? null,
                  }))
                : null
            set({
              keyword: k,
              analysisCountryCode: countryCode,
              status: statusFromBackend,
              analysisStatus,
              summarySection,
              marketTemperatureSection,
              recommendedActionsSection,
              insightsSection,
              result: fullResult,
              error: null,
              newsList: (data.source_links ?? []) as NewsItem[],
              ...(normalizedPipelineTasks
                ? {
                    analysisTasks: normalizedPipelineTasks,
                    taskData: taskDataFromPipeline,
                    analysisId: pipelineAnalysisId,
                  }
                : {}),
            })
            void get().refreshLiveInsightSuggestion()
            return 'cached'
          }
          return data.emptyAnalysis ? 'empty' : 'none'
        } catch {
          return 'error'
        }
      },

      hydrateFromStatusResult: (keyword, countryCode, pollResult) => {
        const k = keyword?.trim()
        if (!k || !pollResult.reportId) return
        const snap = get()
        if (snap.analysisStatus === 'failed' && snap.streamingState.status === 'error') {
          return
        }
        const rawContent = pollResult.content
        const content = (typeof rawContent === 'object' && rawContent != null && !Array.isArray(rawContent)
          ? rawContent
          : {}) as Record<string, unknown>
        const km = parseJsonField(pollResult.key_metrics) as ResearchResponse['key_metrics']
        const poll = pollResult as { reportId?: string; key_metrics?: unknown; content?: Record<string, unknown>; source_links?: unknown[]; updated_at?: string; serper_used?: boolean }
        const fullResult: ResearchResponse = {
          ...content,
          marketNews: Array.isArray(content.marketNews) ? (content.marketNews as string[]) : [],
          painPoints: Array.isArray(content.painPoints) ? (content.painPoints as string[]) : [],
          competitorTrends: typeof content.competitorTrends === 'string' ? content.competitorTrends : '',
          reportId: pollResult.reportId,
          source_links: Array.isArray(pollResult.source_links) ? (pollResult.source_links as Array<{ title?: string; url?: string }>) : [],
          updated_at: pollResult.updated_at ?? undefined,
          serper_used: poll.serper_used === true,
          key_metrics: km,
        } as ResearchResponse
        set({
            keyword: k,
            analysisCountryCode: countryCode,
            status: 'done',
            analysisStatus: 'completed',
            result: fullResult,
            streamingState: createCompletedState(pollResult.reportId),
            error: null,
            newsList: (pollResult.source_links ?? []) as NewsItem[],
          })
        void get().refreshLiveInsightSuggestion()
      },

      loadReportByKeyword: async (keyword: string) => {
        const k = keyword?.trim()
        if (!k) return false
        try {
          const res = await fetch(`/api/reports?keyword=${encodeURIComponent(k)}`)
          const data = (await res.json()) as {
            report?: {
              id: string
              keyword: string
              content: Record<string, unknown>
              ai_responses?: Record<string, string>
              source_links?: Array<{ title?: string; url?: string }>
            }
          }
          const report = data.report
          if (!report?.id) return false
          const content = report.content ?? {}
          set({
            keyword: k,
            status: 'done',
            analysisStatus: 'completed',
            result: {
              ...content,
              reportId: report.id,
              ai_responses: report.ai_responses ?? {},
              source_links: report.source_links ?? [],
            } as ResearchResponse,
            error: null,
            newsList: (report.source_links ?? []) as NewsItem[],
          })
          return true
        } catch {
          return false
        }
      },

      mergeResultAnalysis: (tabId, groqText, geminiText) => {
        const current = get().result
        const summary = get().summarySection
        if (!current?.reportId) return
        const prevGroq = (current.analysis_groq as Record<string, string> | undefined) ?? {}
        const prevGemini = (current.analysis_gemini ?? {}) as Record<string, string>
        const nextResult = {
          ...current,
          analysis_groq: groqText !== null ? { ...prevGroq, [tabId]: groqText } : current.analysis_groq,
          analysis_gemini: geminiText !== null ? { ...prevGemini, [tabId]: geminiText } : current.analysis_gemini,
        } as ResearchResponse
        set({
          result: nextResult,
          summarySection: summary ? { ...summary, analysis_groq: nextResult.analysis_groq, analysis_gemini: nextResult.analysis_gemini } : null,
        })
      },

      /** @deprecated Job polling will be replaced by streaming. Use startStreamingResearch for new analyses. */
      refreshJobs: async () => {
        try {
          const prevJobs = get().jobs
          const res = await fetch('/api/research/jobs')
          const data = (await res.json()) as { list?: AnalysisJob[] }
          const list = data.list ?? []
          const jobs: Record<string, AnalysisJob> = {}
          const rawOrder: string[] = []
          for (const job of list) {
            jobs[job.id] = job
            rawOrder.push(job.id)
          }
          // Toast on status transitions: analyzing→completed, analyzing→failed (one-directional).
          for (const job of list) {
            const prev = prevJobs[job.id]
            if (job.status === 'succeeded' && prev && (prev.status === 'running' || prev.status === 'queued')) {
              toast.success(`${job.keyword} 분석 완료`, { duration: 3000 })
            }
            if ((job.status === 'failed' || job.status === 'cancelled') && prev && prev.status === 'running') {
              toast.error(`${job.keyword} 분석 실패`, { duration: 4000 })
            }
          }
          const jobOrder = pickOneJobIdPerKey(jobs, rawOrder)
          set({ jobs, jobOrder })
          // Keep active selection on current job when still in list; else first of queue.
          const current = get()
          const activeJobId = current.activeJobId && jobs[current.activeJobId]
            ? current.activeJobId
            : (jobOrder[0] ?? null)
          if (!current.activeJobId && activeJobId) set({ activeJobId })

          if (activeJobId && jobs[activeJobId]) {
            const active = jobs[activeJobId]
            const prev = get()
            // Do not overwrite keyword/result when user is viewing a cached result for a different keyword (e.g. from URL).
            // Prevents "분석 불가" / loading flash when results page shows cached data and refreshJobs picks another job.
            const viewingCachedOtherKeyword =
              Boolean(prev.result?.reportId && (prev.keyword ?? '').trim()) &&
              (active.keyword?.trim() ?? '') !== (prev.keyword?.trim() ?? '')
            if (viewingCachedOtherKeyword) {
              set({ activeJobId })
              return
            }
            const nextStatus = active.status === 'succeeded' ? 'done' : active.status === 'failed' || active.status === 'cancelled' ? 'error' : 'loading'
            const nextAnalysisStatus = jobStatusToTaskStatus(active.status)
            const isTerminal = prev.analysisStatus === 'completed' || prev.analysisStatus === 'failed'
            const wouldRevert = isTerminal && (nextAnalysisStatus === 'queued' || nextAnalysisStatus === 'analyzing')
            if (!wouldRevert) {
              set({
                status: nextStatus,
                analysisStatus: nextAnalysisStatus,
                error: active.error ?? null,
                keyword: active.keyword,
                activeJobId,
              })
              if (active.keyword) {
                const alreadyHaveResult = prev.result?.reportId && (prev.keyword?.trim() ?? '') === (active.keyword?.trim() ?? '')
                const isActiveJob = (prev.keyword?.trim() ?? '') === (active.keyword?.trim() ?? '')
                if (active.status === 'succeeded' && !alreadyHaveResult) await get().loadFromHistory(active.keyword, active.country_code)
                if (active.status === 'running' && active.report_id && isActiveJob && !alreadyHaveResult) await get().loadFromHistory(active.keyword, active.country_code)
              }
            } else {
              set({ activeJobId, keyword: active.keyword })
            }
          }
        } catch {
          /* ignore */
        }
      },

      setActiveJob: async (jobId: string | null) => {
        const job = jobId ? get().jobs[jobId] : null
        if (!jobId || !job) {
          set({ activeJobId: null })
          return
        }
        const state = get()
        const isSameJob = state.activeJobId === jobId && (state.keyword?.trim() ?? '') === (job.keyword?.trim() ?? '')
        const isSameKeyword = (state.keyword?.trim() ?? '') === (job.keyword?.trim() ?? '')
        const haveCompletedResult = !!(state.result?.reportId && (state.analysisStatus === 'completed' || state.status === 'done'))
        const preserveResult = isSameKeyword && haveCompletedResult
        const status = job.status === 'succeeded' ? 'done' : job.status === 'failed' || job.status === 'cancelled' ? 'error' : 'loading'
        const analysisStatus = jobStatusToTaskStatus(job.status)
        set({
          activeJobId: jobId,
          keyword: job.keyword,
          status,
          analysisStatus,
          error: job.error ?? null,
          ...(isSameJob || preserveResult ? {} : { result: null, newsList: [], summarySection: null, marketTemperatureSection: null, recommendedActionsSection: null, insightsSection: null }),
        })
        if (job.status === 'succeeded') {
          await get().loadFromHistory(job.keyword, job.country_code)
        }
      },

      setActiveJobByKeyword: async (keyword: string) => {
        const k = keyword.trim()
        if (!k) return
        const state = get()
        const { jobOrder, jobs } = state
        const foundId = jobOrder.find((id) => jobs[id]?.keyword === k) ?? null
        if (foundId) {
          await get().setActiveJob(foundId)
          return
        }
        const storeK = (state.keyword ?? '').trim()
        const isSameKeyword = storeK === k
        set({
          keyword: k,
          status: isSameKeyword ? state.status : 'idle',
          analysisStatus: isSameKeyword ? state.analysisStatus : 'queued',
          error: null,
          result: isSameKeyword ? state.result : null,
          summarySection: isSameKeyword ? state.summarySection : null,
          marketTemperatureSection: isSameKeyword ? state.marketTemperatureSection : null,
          recommendedActionsSection: isSameKeyword ? state.recommendedActionsSection : null,
          insightsSection: isSameKeyword ? state.insightsSection : null,
          newsList: isSameKeyword ? state.newsList : [],
        })
      },

      /** @deprecated Use startStreamingResearch instead. Will be removed after job system migration. */
      retryJob: async (jobId: string) => {
        try {
          await fetch('/api/research/jobs/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
          })
          toast.info('분석을 다시 시작했습니다.')
        } catch (err) {
          showErrorToast(err, { fallbackMessage: '재시도에 실패했습니다.' })
        }
      },

      /** @deprecated Use startStreamingResearch instead. Will be removed after job system migration. */
      cancelJob: async (jobId: string) => {
        try {
          await fetch(`/api/research/jobs/${encodeURIComponent(jobId)}`, { method: 'PATCH' })
          toast.info('분석을 취소했습니다.')
          await get().refreshJobs()
        } catch (err) {
          showErrorToast(err, { fallbackMessage: '취소에 실패했습니다.' })
        }
      },

      /** @deprecated Use startStreamingResearch instead. Job-based polling will be removed. */
      startResearch: (keyword: string, options?: { fromRetry?: boolean; country_code?: string }) => {
        const k = keyword?.trim()
        if (!k) {
          toast.error('검색어가 없습니다.')
          set({ status: 'error', error: '검색어가 없습니다.' })
          return
        }
        set({
          keyword: k,
          status: 'loading',
          analysisStatus: 'analyzing',
          newsList: [],
          result: null,
          summarySection: null,
          marketTemperatureSection: null,
          recommendedActionsSection: null,
          insightsSection: null,
          error: null,
          insights: null,
        })

        const run = async () => {
          try {
            const checkRes = await fetch('/api/settings')
            if (checkRes.ok) {
              const checkData = (await checkRes.json()) as { canSearch?: boolean }
              if (checkData.canSearch === false) {
                toast.error('설정에서 API 키를 등록한 뒤 분석을 사용할 수 있습니다.', {
                  action: {
                    label: '설정으로 이동',
                    onClick: () => { window.location.href = '/settings?tab=license' },
                  },
                })
                set({
                  status: 'error',
                  error: '설정에서 API 키를 등록한 뒤 분석을 사용할 수 있습니다.',
                })
                return
              }
            }

            const countryCode = options?.country_code ?? 'KR'
            const res = await fetch('/api/research/jobs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: k, country_code: countryCode }),
            })
            const data = (await res.json()) as { job?: AnalysisJob; error?: string }
            if (!res.ok || !data.job) {
              showErrorToast(data, { fallbackMessage: data.error ?? '요청에 실패했어요.' })
              set({ status: 'error', error: data.error ?? '요청에 실패했어요.' })
              return
            }

            const job = data.job
            toast.info('분석을 시작했습니다.', { duration: 2500 })
            set((state) => {
              const key = `${job.keyword?.trim()}|${countryCode}`
              const nextJobs = { ...state.jobs, [job.id]: job }
              const toRemove = state.jobOrder.filter((id) => {
                const j = state.jobs[id]
                if (!j || id === job.id) return false
                return `${(j.keyword ?? '').trim()}|${(j.country_code ?? 'KR').trim()}` === key
              })
              toRemove.forEach((id) => delete nextJobs[id])
              const nextOrder = [job.id, ...state.jobOrder.filter((id) => id !== job.id && !toRemove.includes(id))]
              return { jobs: nextJobs, jobOrder: nextOrder }
            })
            await get().setActiveJob(job.id)
          } catch (err) {
            console.error('[ResearchStore] create job failed:', err)
            const msg = '분석을 시작하지 못했어요. 다시 시도해 주세요.'
            showErrorToast(err, { fallbackMessage: msg })
            set({ status: 'error', error: msg })
          }
        }

        void run()
      },
}),
    {
      name: 'datamod-research-store',
      /** Next.js SSR: 첫 페인트는 서버와 동일한 기본 상태로 맞추고, 클라이언트 마운트 후 rehydrate */
      skipHydration: true,
      migrate: (persisted: unknown, version: number) => {
        const p = persisted as { state?: Partial<ResearchState>; version?: number }
        const s = p?.state as Partial<ResearchState> | undefined
        if (!s) return persisted as { state: ResearchState; version?: number }
        let next = { ...s }
        if (version < 1 || !('analysisStatus' in next)) {
          const derived: CanonicalAnalysisStatus =
            next.status === 'done' ? 'completed'
            : next.status === 'error' ? 'failed'
            : next.status === 'loading' ? 'analyzing'
            : 'queued'
          next = { ...next, analysisStatus: derived }
        }
        if (!('summarySection' in next)) next = { ...next, summarySection: null, marketTemperatureSection: null, recommendedActionsSection: null, insightsSection: null }
        // v3: Add analysis mode and streaming state
        if (version < 3 || !('analysisMode' in next)) {
          next = {
            ...next,
            analysisMode: DEFAULT_ANALYSIS_MODE,
            streamingState: createIdleState(),
            currentStep: 0,
            totalSteps: getStepCount(DEFAULT_ANALYSIS_MODE),
            lastSuccessfulReport: null,
          }
        }
        if (version < 4 || typeof (next as { analysisCountryCode?: string }).analysisCountryCode !== 'string') {
          next = {
            ...next,
            analysisCountryCode: 'KR',
            liveInsightSuggestion: null,
            liveInsightSuggestionLoading: false,
          }
        }
        return { ...p, state: next as ResearchState }
      },
      version: 5,
      storage: {
        getItem: (name: string) => {
          if (typeof window === 'undefined') return null
          try {
            const raw = localStorage.getItem(name)
            if (raw == null) return null
            const parsed = JSON.parse(raw) as { state?: unknown; version?: number }
            return parsed && typeof parsed === 'object' && 'state' in parsed
              ? { state: parsed.state, version: parsed.version }
              : { state: parsed, version: 0 }
          } catch {
            return null
          }
        },
        setItem: (name: string, value: { state: unknown; version?: number }) => {
          if (typeof window === 'undefined') return
          try {
            localStorage.setItem(name, JSON.stringify(value))
          } catch {
            /* ignore */
          }
        },
        removeItem: (name: string) => {
          if (typeof window === 'undefined') return
          try {
            localStorage.removeItem(name)
          } catch {
            /* ignore */
          }
        },
      },
      partialize: (state) => {
        const analyzing =
          state.status === 'loading' &&
          (state.streamingState.status === 'running' || state.streamingState.status === 'streaming')
        const base = {
          keyword: state.keyword,
          analysisCountryCode: state.analysisCountryCode,
          status: state.status,
          analysisStatus: state.analysisStatus,
          analysisMode: state.analysisMode,
          newsList: state.newsList,
          result: state.result,
          summarySection: state.summarySection,
          marketTemperatureSection: state.marketTemperatureSection,
          recommendedActionsSection: state.recommendedActionsSection,
          insightsSection: state.insightsSection,
          error: state.error,
          insights: state.insights,
          lastSuccessfulReport: state.lastSuccessfulReport,
        }
        if (!analyzing) return base
        return {
          ...base,
          analysisId: state.analysisId,
          currentStep: state.currentStep,
          totalSteps: state.totalSteps,
          streamingState: state.streamingState,
          taskData: state.taskData,
          analysisTasks: state.analysisTasks,
          streamingActivityLog: state.streamingActivityLog.slice(-80),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.status === 'loading') {
          const ss = state.streamingState
          const mid = ss.status === 'running' || ss.status === 'streaming'
          state.status = 'idle'
          state.analysisStatus = 'queued'
          if (mid) {
            state.streamingState = createIdleState()
            state.error =
              '분석 중 페이지를 벗어났거나 새로고침되어 스트림이 끊겼습니다. 저장된 중간 결과가 있으면 아래에 표시됩니다. 이어서 분석하려면 동일 키워드로 다시 실행하거나, 실패한 단계에서 재시도하세요.'
          }
        }
        const reportId = state.result && typeof state.result === 'object' && 'reportId' in state.result
          ? (state.result as { reportId?: string | null }).reportId
          : null
        if (reportId) {
          queueMicrotask(() => {
            void useResearchStore.getState().refreshLiveInsightSuggestion()
          })
        }
      },
    }
  )
)
