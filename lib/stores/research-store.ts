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
import type { AnalysisTask } from '@/lib/analysis-types'
import { jobStatusToTaskStatus } from '@/lib/analysis-types'

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
    market_temperature_score?: number
    confidence_score?: number
    analysis_target?: string
    summary_insights?: string
  }
}

type ResearchStatus = 'idle' | 'loading' | 'done' | 'error'

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
  newsList: NewsItem[]
  result: ResearchResponse | null
  error: string | null
  insights: string | null
  /** Gemini 오늘 사용량 (에너지 바용). null이면 아직 로드 안 함 */
  geminiQuota: GeminiQuota | null
  jobs: Record<string, AnalysisJob>
  jobOrder: string[]
  activeJobId: string | null
}

/** loadFromHistory 반환: 'cached' = 캐시 있음 사용함, 'empty' = 기록 있으나 내용 없음, 'none' = 기록 없음, 'error' = 요청 실패(스트림 시작 금지) */
export type LoadHistoryResult = 'cached' | 'empty' | 'none' | 'error'

type TabId = 'logic' | 'creative' | 'fact'

/** DB/API sometimes returns JSON as string; normalize to object for store. */
function parseJsonField<T>(value: unknown): T | undefined {
  if (value == null) return undefined
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return undefined
    }
  }
  return value as T
}

interface ResearchStore extends ResearchState {
  startResearch: (keyword: string, options?: { fromRetry?: boolean; country_code?: string }) => void
  refreshJobs: () => Promise<void>
  setActiveJob: (jobId: string | null) => Promise<void>
  setActiveJobByKeyword: (keyword: string) => Promise<void>
  retryJob: (jobId: string) => Promise<void>
  cancelJob: (jobId: string) => Promise<void>
  /** research_history 캐시 조회. 캐시 있으면 복원 후 'cached', 비어있으면 'empty', 없으면 'none'. */
  loadFromHistory: (keyword: string, countryCode?: string) => Promise<LoadHistoryResult>
  /** 키워드로 DB에 캐시된 리포트가 있으면 복원하고 true 반환. 없으면 false. */
  loadReportByKeyword: (keyword: string) => Promise<boolean>
  /** 탭 API 응답을 result에 병합. refetch 없이 UI/동기화 effect에 반영. */
  mergeResultAnalysis: (tabId: TabId, groqText: string | null, geminiText: string | null) => void
  setInsights: (value: string | null) => void
  setGeminiQuota: (quota: GeminiQuota | null) => void
  fetchGeminiQuota: () => Promise<void>
  reset: () => void
}

const initialState: ResearchState = {
  keyword: '',
  status: 'idle',
  newsList: [],
  result: null,
  error: null,
  insights: null,
  geminiQuota: null,
  jobs: {},
  jobOrder: [],
  activeJobId: null,
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
      reset: () => set(initialState),

      loadFromHistory: async (keyword: string, countryCode = 'KR') => {
        const k = keyword?.trim()
        if (!k) return 'none'
        try {
          const res = await fetch(`/api/research/history?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(countryCode)}`)
          const data = (await res.json()) as {
            cached?: boolean
            emptyAnalysis?: boolean
            reportId?: string
            keyword?: string
            content?: Record<string, unknown>
            source_links?: Array<{ title?: string; url?: string }>
            ai_responses?: Record<string, string>
            key_metrics?: unknown
            updated_at?: string
            analysis_groq?: { summary: string; modelName: string }
            analysis_gemini?: Record<string, string>
            analysis_results?: { summary?: string; sentiment?: number; strategic_insight?: string; action_item?: string; confidence?: number }
          }
          if (!res.ok) {
            if (res.status === 401) return 'none'
            return 'error'
          }
          if (!data.cached) return 'none'
          if (data.emptyAnalysis) return 'empty'
          const ar = parseJsonField(data.analysis_results) as ResearchResponse['analysis_results']
          const km = parseJsonField(data.key_metrics) as ResearchResponse['key_metrics']
          // State: use analysis_status from API; never infer from partial data. Legacy: no analysis_status → completed.
          const analysisStatus = ((data as { analysis_status?: string }).analysis_status as 'queued' | 'analyzing' | 'completed' | 'failed' | undefined) ?? 'completed'
          if (data.reportId) {
            const statusFromBackend =
              analysisStatus === 'completed' ? 'done' as const
              : analysisStatus === 'failed' ? 'error' as const
              : analysisStatus === 'analyzing' || analysisStatus === 'queued' ? 'loading' as const
              : 'done' as const
            set({
              keyword: k,
              status: statusFromBackend,
              result: {
                ...(data.content ?? {}),
                reportId: data.reportId,
                ai_responses: data.ai_responses ?? {},
                source_links: data.source_links ?? [],
                updated_at: data.updated_at,
                analysis_groq: data.analysis_groq,
                analysis_gemini: data.analysis_gemini,
                analysis_results: ar,
                key_metrics: km,
              } as ResearchResponse,
              error: null,
              newsList: (data.source_links ?? []) as NewsItem[],
            })
            return 'cached'
          }
          return data.emptyAnalysis ? 'empty' : 'none'
        } catch {
          return 'error'
        }
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
        if (!current?.reportId) return
        const prevGroq = (current.analysis_groq as Record<string, string> | undefined) ?? {}
        const prevGemini = (current.analysis_gemini ?? {}) as Record<string, string>
        set({
          result: {
            ...current,
            analysis_groq: groqText !== null ? { ...prevGroq, [tabId]: groqText } : current.analysis_groq,
            analysis_gemini: geminiText !== null ? { ...prevGemini, [tabId]: geminiText } : current.analysis_gemini,
          } as ResearchResponse,
        })
      },

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
            const nextStatus = active.status === 'succeeded' ? 'done' : active.status === 'failed' || active.status === 'cancelled' ? 'error' : 'loading'
            set({
              status: nextStatus,
              error: active.error ?? null,
              keyword: active.keyword,
              activeJobId,
            })
            if (active.status === 'succeeded' && active.keyword) {
              await get().loadFromHistory(active.keyword, active.country_code)
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
        const status = job.status === 'succeeded' ? 'done' : job.status === 'failed' || job.status === 'cancelled' ? 'error' : 'loading'
        set({
          activeJobId: jobId,
          keyword: job.keyword,
          status,
          error: job.error ?? null,
          ...(isSameJob ? {} : { result: null, newsList: [] }),
        })
        if (job.status === 'succeeded') {
          await get().loadFromHistory(job.keyword, job.country_code)
        }
      },

      setActiveJobByKeyword: async (keyword: string) => {
        const k = keyword.trim()
        if (!k) return
        const { jobOrder, jobs } = get()
        const foundId = jobOrder.find((id) => jobs[id]?.keyword === k) ?? null
        if (foundId) {
          await get().setActiveJob(foundId)
          return
        }
        set({
          keyword: k,
          status: 'idle',
          error: null,
          result: null,
          newsList: [],
        })
      },

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

      cancelJob: async (jobId: string) => {
        try {
          await fetch(`/api/research/jobs/${encodeURIComponent(jobId)}`, { method: 'PATCH' })
          toast.info('분석을 취소했습니다.')
          await get().refreshJobs()
        } catch (err) {
          showErrorToast(err, { fallbackMessage: '취소에 실패했습니다.' })
        }
      },

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
          newsList: [],
          result: null,
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
      name: 'rin-research-store',
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
      partialize: (state) => ({
        keyword: state.keyword,
        status: state.status,
        newsList: state.newsList,
        result: state.result,
        error: state.error,
        insights: state.insights,
      }),
    }
  )
)
