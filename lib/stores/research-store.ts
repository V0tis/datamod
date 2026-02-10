'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'

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
}

type StreamPayload =
  | { step: 'firecrawl_start' }
  | { step: 'firecrawl_done'; news: NewsItem[] }
  | { step: 'gemini_start' }
  | { step: 'chart_ready' }
  | { step: 'gemini_done' }
  | { step: 'result'; data: ResearchResponse }
  | { step: 'error'; error: string; retryDelay?: number }

type ResearchStatus = 'idle' | 'loading' | 'done' | 'error'

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
}

/** 429 등 retryDelay 응답 후 한 번만 재시도하기 위한 플래그 */
let retryScheduledForStream = false

/** loadFromHistory 반환: 'cached' = 캐시 있음 사용함, 'empty' = 기록 있으나 내용 없음(최초 분석 필요), 'none' = 기록 없음 */
export type LoadHistoryResult = 'cached' | 'empty' | 'none'

interface ResearchStore extends ResearchState {
  startResearch: (keyword: string, options?: { fromRetry?: boolean; country_code?: string }) => void
  /** research_history 캐시 조회. 캐시 있으면 복원 후 'cached', 비어있으면 'empty', 없으면 'none'. */
  loadFromHistory: (keyword: string, countryCode?: string) => Promise<LoadHistoryResult>
  /** 키워드로 DB에 캐시된 리포트가 있으면 복원하고 true 반환. 없으면 false. */
  loadReportByKeyword: (keyword: string) => Promise<boolean>
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
}

function showToastForStep(step: string) {
  if (step === 'firecrawl_start') {
    toast.info('뉴스를 찾는 중...')
  } else if (step === 'firecrawl_done') {
    toast.success('뉴스 수집 완료. 분석을 시작할게요.')
  } else if (step === 'gemini_start') {
    toast.info('린이 모든 정보를 모아 한꺼번에 분석 중이에요...')
  } else if (step === 'chart_ready') {
    toast.info('데이터 시각화 차트 그리는 중...')
  } else if (step === 'gemini_done') {
    toast.info('리포트 정리 중...')
  } else if (step === 'result') {
    toast.success('분석이 완료되었습니다.')
  }
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
          }
          if (!data.cached) return 'none'
          if (data.emptyAnalysis && !data.reportId) return 'empty'
          if (data.emptyAnalysis && data.reportId) return 'empty'
          if (data.reportId && (data.content != null || data.ai_responses)) {
            set({
              keyword: k,
              status: 'done',
              result: {
                ...(data.content ?? {}),
                reportId: data.reportId,
                ai_responses: data.ai_responses ?? {},
                source_links: data.source_links ?? [],
                updated_at: data.updated_at,
              } as ResearchResponse,
              error: null,
              newsList: get().newsList,
            })
            return 'cached'
          }
          return data.emptyAnalysis ? 'empty' : 'none'
        } catch {
          return 'none'
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
            newsList: get().newsList,
          })
          return true
        } catch {
          return false
        }
      },

      startResearch: (keyword: string, options?: { fromRetry?: boolean }) => {
    const { status, keyword: currentKeyword } = get()
    if (!options?.fromRetry) retryScheduledForStream = false
    const k = keyword?.trim()
    if (!k) {
      toast.error('검색어가 없습니다.')
      set({ status: 'error', error: '검색어가 없습니다.' })
      return
    }
    if (status === 'loading' && currentKeyword === k) {
      toast.info('린이 이미 열심히 분석 중이에요!')
      return
    }
    if (status === 'done' && currentKeyword === k) {
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
            toast.error('키를 등록해 주세요. 설정에서 API 키를 등록하면 분석을 사용할 수 있어요.', {
              action: {
                label: '키 등록하러 가기',
                onClick: () => { window.location.href = '/settings?tab=license' },
              },
            })
            set({
              status: 'error',
              error: '키를 등록해 주세요. 설정에서 API 키를 등록하면 분석을 사용할 수 있어요.',
            })
            return
          }
        }
        const countryCode = options?.country_code ?? 'KR'
        const res = await fetch('/api/research/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k, country_code: countryCode }),
          keepalive: true,
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}))
          showErrorToast(err, { fallbackMessage: '요청에 실패했어요.' })
          set({
            status: 'error',
            error: (err as { error?: string }).error ?? '요청에 실패했어요.',
          })
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let lastToastStep: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() ?? ''

          for (const chunk of lines) {
            const eventMatch = chunk.match(/^event:\s*(\w+)\ndata:\s*(.+)/s)
            if (!eventMatch) continue
            const [, , dataStr] = eventMatch
            try {
              const payload = JSON.parse(dataStr) as StreamPayload
              const step = payload.step

              if (step === 'firecrawl_done' && 'news' in payload) {
                set({ newsList: payload.news })
                if (lastToastStep !== step) {
                  lastToastStep = step
                  showToastForStep(step)
                }
              } else if (step === 'firecrawl_start') {
                if (lastToastStep !== step) {
                  lastToastStep = step
                  showToastForStep(step)
                }
              } else if (step === 'gemini_start' || step === 'gemini_done' || step === 'chart_ready') {
                if (lastToastStep !== step) {
                  lastToastStep = step
                  showToastForStep(step)
                }
              } else if (step === 'result' && 'data' in payload) {
                const data = payload.data as ResearchResponse
                set({
                  status: 'done',
                  result: { ...data, updated_at: new Date().toISOString() },
                  insights: data.publicReactionTrends ?? get().insights,
                  keyword: get().keyword,
                })
                if (lastToastStep !== step) {
                  lastToastStep = step
                  showToastForStep(step)
                }
                get().fetchGeminiQuota()
                return
              } else if (step === 'error' && 'error' in payload) {
                showErrorToast({ error: payload.error })
                set({
                  status: 'error',
                  error: payload.error,
                })
                const delaySec = (payload as { retryDelay?: number }).retryDelay
                if (
                  typeof delaySec === 'number' &&
                  delaySec > 0 &&
                  !retryScheduledForStream
                ) {
                  retryScheduledForStream = true
                  const k = get().keyword
                  toast.info(`${delaySec}초 후 한 번 더 시도할게요.`)
                  setTimeout(() => {
                    get().startResearch(k, { fromRetry: true })
                  }, delaySec * 1000)
                }
                return
              }
            } catch (_) {
              /* ignore parse errors */
            }
          }
        }

        if (get().status === 'loading') {
          const msg = '응답이 완료되지 않았어요.'
          showErrorToast(new Error(msg))
          set({ status: 'error', error: msg })
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('[ResearchStore] stream failed:', err)
        const msg = '분석을 완료하지 못했어요. 다시 시도해 주세요.'
        showErrorToast(err, { fallbackMessage: msg })
        set({
          status: 'error',
          error: msg,
        })
      }
    }

    run()
  },
}),
    {
      name: 'rin-research-store',
      storage: {
        getItem: (name: string) => {
          if (typeof window === 'undefined') return null
          try {
            return localStorage.getItem(name)
          } catch {
            return null
          }
        },
        setItem: (name: string, value: string) => {
          if (typeof window === 'undefined') return
          try {
            localStorage.setItem(name, value)
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
