'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from 'sonner'

export interface NewsItem {
  title: string
  url: string
  content?: string
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

interface ResearchStore extends ResearchState {
  startResearch: (keyword: string, options?: { fromRetry?: boolean }) => void
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
    toast.success('리포트 배달 완료! 🐕')
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

      startResearch: (keyword: string, options?: { fromRetry?: boolean }) => {
    const { status, keyword: currentKeyword } = get()
    if (!options?.fromRetry) retryScheduledForStream = false
    if (!keyword?.trim()) {
      toast.error('검색어가 없습니다.')
      set({ status: 'error', error: '검색어가 없습니다.' })
      return
    }
    if (status === 'loading') {
      toast.info('린이 이미 열심히 분석 중이에요!')
      return
    }
    if (status === 'done' && currentKeyword === keyword.trim()) {
      return
    }

    set({
      keyword: keyword.trim(),
      status: 'loading',
      newsList: [],
      result: null,
      error: null,
      insights: null,
    })

    const run = async () => {
      const k = keyword.trim()
      try {
        const checkRes = await fetch('/api/settings')
        if (checkRes.ok) {
          const checkData = (await checkRes.json()) as { canSearch?: boolean }
          if (checkData.canSearch === false) {
            toast.error('라이선스 키가 필요합니다.')
            set({
              status: 'error',
              error: '라이선스 키가 필요합니다.',
            })
            return
          }
        }
        const res = await fetch('/api/research/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k }),
          keepalive: true,
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}))
          const errMsg = (err as { error?: string }).error ?? '요청에 실패했어요.'
          toast.error(errMsg)
          set({
            status: 'error',
            error: errMsg,
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
                  result: data,
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
                toast.error(payload.error)
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
          toast.error(msg)
          set({ status: 'error', error: msg })
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('[ResearchStore] stream failed:', err)
        const msg = '데이터를 불러오는 중 오류가 발생했습니다.'
        toast.error(msg)
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
