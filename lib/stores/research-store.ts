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
  reportId?: string | null
  error?: string
}

type StreamPayload =
  | { step: 'firecrawl_start' }
  | { step: 'firecrawl_done'; news: NewsItem[] }
  | { step: 'gemini_start' }
  | { step: 'gemini_done' }
  | { step: 'result'; data: ResearchResponse }
  | { step: 'error'; error: string }

type ResearchStatus = 'idle' | 'loading' | 'done' | 'error'

interface ResearchState {
  keyword: string
  status: ResearchStatus
  newsList: NewsItem[]
  result: ResearchResponse | null
  error: string | null
  insights: string | null
}

interface ResearchStore extends ResearchState {
  startResearch: (keyword: string) => void
  setInsights: (value: string | null) => void
  reset: () => void
}

const initialState: ResearchState = {
  keyword: '',
  status: 'idle',
  newsList: [],
  result: null,
  error: null,
  insights: null,
}

function showToastForStep(step: string) {
  if (step === 'firecrawl_start') {
    toast.info('뉴스를 찾는 중...')
  } else if (step === 'firecrawl_done') {
    toast.success('뉴스 수집 완료. 분석을 시작할게요.')
  } else if (step === 'gemini_start') {
    toast.info('분석 중...')
  } else if (step === 'result') {
    toast.success('리포트 배달 완료! 🐕')
  }
}

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setInsights: (value) => set({ insights: value }),
      reset: () => set(initialState),

      startResearch: (keyword: string) => {
    const { status, keyword: currentKeyword } = get()
    if (!keyword?.trim()) {
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
        const res = await fetch('/api/research/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k }),
          keepalive: true,
        })

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({}))
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
              } else if (step === 'gemini_start' || step === 'gemini_done') {
                if (lastToastStep !== step) {
                  lastToastStep = step
                  showToastForStep(step)
                }
              } else if (step === 'result' && 'data' in payload) {
                set({
                  status: 'done',
                  result: payload.data,
                  keyword: get().keyword,
                })
                if (lastToastStep !== step) {
                  lastToastStep = step
                  showToastForStep(step)
                }
                return
              } else if (step === 'error' && 'error' in payload) {
                set({
                  status: 'error',
                  error: payload.error,
                })
                return
              }
            } catch (_) {
              /* ignore parse errors */
            }
          }
        }

        if (get().status === 'loading') {
          set({ status: 'error', error: '응답이 완료되지 않았어요.' })
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        console.error('[ResearchStore] stream failed:', err)
        set({
          status: 'error',
          error: '데이터를 불러오는 중 오류가 발생했습니다.',
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
