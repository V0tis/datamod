'use client'

import { useMemo, useState, useReducer, useRef, useCallback } from 'react'
import Link from 'next/link'
import { RefreshCcw, Ban, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResearchStore, type AnalysisJob } from '@/lib/stores/research-store'

/**
 * Explicit state machine for analysis status display.
 * Union type ensures exhaustive handling and prevents invalid states.
 */
type AnalysisDisplayState =
  | { status: 'idle' }
  | { status: 'fetching_news' }
  | { status: 'analyzing_pass1'; newsCount: number }
  | { status: 'analyzing_pass2'; summary: string }
  | { status: 'generating_creative' }
  | { status: 'completed'; reportId: string }
  | { status: 'failed'; error: string }
  | { status: 'cancelled' }
  | { status: 'cached'; reportId: string }

type AnalysisAction =
  | { type: 'START' }
  | { type: 'NEWS_RECEIVED'; count: number }
  | { type: 'PASS1_COMPLETE'; summary: string }
  | { type: 'PASS2_COMPLETE' }
  | { type: 'CREATIVE_COMPLETE' }
  | { type: 'DONE'; reportId: string }
  | { type: 'CACHED'; reportId: string }
  | { type: 'ERROR'; message: string }
  | { type: 'CANCEL' }
  | { type: 'RESET' }

function analysisReducer(
  state: AnalysisDisplayState,
  action: AnalysisAction
): AnalysisDisplayState {
  switch (action.type) {
    case 'START':
      return { status: 'fetching_news' }
    case 'NEWS_RECEIVED':
      return { status: 'analyzing_pass1', newsCount: action.count }
    case 'PASS1_COMPLETE':
      return { status: 'analyzing_pass2', summary: action.summary }
    case 'PASS2_COMPLETE':
      return { status: 'generating_creative' }
    case 'CREATIVE_COMPLETE':
      return state
    case 'DONE':
      return { status: 'completed', reportId: action.reportId }
    case 'CACHED':
      return { status: 'cached', reportId: action.reportId }
    case 'ERROR':
      return { status: 'failed', error: action.message }
    case 'CANCEL':
      return { status: 'cancelled' }
    case 'RESET':
      return { status: 'idle' }
    default:
      return state
  }
}

const statusLabel: Record<string, string> = {
  idle: '대기',
  fetching_news: '뉴스 수집',
  analyzing_pass1: '1차 분석',
  analyzing_pass2: '상세 분석',
  generating_creative: '인사이트 생성',
  completed: '완료',
  failed: '실패',
  cancelled: '취소됨',
  cached: '캐시 사용',
  queued: '대기 중',
  running: '분석 중',
  succeeded: '완료',
}

const legacyStepLabel: Record<string, string> = {
  news: '뉴스 수집',
  gemini: 'AI 분석',
  creative: '인사이트 생성',
  parse_json: '결과 정리',
  report_db: '리포트 저장',
  pass2: '상세 분석',
  done: '완료',
  cached: '캐시 사용',
}

function isJobActive(job: AnalysisJob): boolean {
  return job.status === 'queued' || job.status === 'running'
}

function isStateActive(state: AnalysisDisplayState): boolean {
  return (
    state.status === 'fetching_news' ||
    state.status === 'analyzing_pass1' ||
    state.status === 'analyzing_pass2' ||
    state.status === 'generating_creative'
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'failed':
      return 'bg-red-500/10 text-red-500'
    case 'completed':
    case 'succeeded':
    case 'cached':
      return 'bg-emerald-500/10 text-emerald-500'
    case 'cancelled':
      return 'bg-amber-500/10 text-amber-500'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function getProgressLabel(state: AnalysisDisplayState): string {
  switch (state.status) {
    case 'fetching_news':
      return '뉴스 수집 중...'
    case 'analyzing_pass1':
      return `${state.newsCount}개 뉴스 분석 중...`
    case 'analyzing_pass2':
      return '상세 분석 중...'
    case 'generating_creative':
      return '인사이트 생성 중...'
    default:
      return ''
  }
}

/**
 * Hook for managing streaming analysis with AbortController.
 * Prevents double submission and allows cancellation.
 */
function useStreamingAnalysis() {
  const [state, dispatch] = useReducer(analysisReducer, { status: 'idle' })
  const abortControllerRef = useRef<AbortController | null>(null)

  const startAnalysis = useCallback(
    async (keyword: string, countryCode: string = 'KR') => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      dispatch({ type: 'START' })

      try {
        const res = await fetch('/api/research/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword, country_code: countryCode }),
          signal,
        })

        if (!res.ok) {
          const errData = (await res.json().catch(() => ({}))) as { error?: string }
          dispatch({ type: 'ERROR', message: errData.error ?? '분석 요청에 실패했어요.' })
          return null
        }

        const reader = res.body?.getReader()
        if (!reader) {
          dispatch({ type: 'ERROR', message: '스트림을 읽을 수 없습니다.' })
          return null
        }

        const decoder = new TextDecoder()
        let buffer = ''
        let reportId: string | null = null

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            try {
              const event = JSON.parse(trimmed) as {
                type: string
                items?: Array<{ title: string }>
                summary?: string
                reportId?: string
                message?: string
              }

              switch (event.type) {
                case 'news':
                  dispatch({ type: 'NEWS_RECEIVED', count: event.items?.length ?? 0 })
                  break
                case 'pass1':
                  dispatch({ type: 'PASS1_COMPLETE', summary: event.summary ?? '' })
                  break
                case 'pass2':
                  dispatch({ type: 'PASS2_COMPLETE' })
                  break
                case 'creative':
                  dispatch({ type: 'CREATIVE_COMPLETE' })
                  break
                case 'done':
                  reportId = event.reportId ?? null
                  dispatch({ type: 'DONE', reportId: reportId ?? '' })
                  break
                case 'cached':
                  reportId = event.reportId ?? null
                  dispatch({ type: 'CACHED', reportId: reportId ?? '' })
                  break
                case 'error':
                  dispatch({ type: 'ERROR', message: event.message ?? '분석 중 오류 발생' })
                  break
              }
            } catch {
              /* skip invalid JSON */
            }
          }
        }

        return reportId
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          dispatch({ type: 'CANCEL' })
          return null
        }
        dispatch({
          type: 'ERROR',
          message: (err as Error).message ?? '분석을 시작하지 못했어요.',
        })
        return null
      } finally {
        abortControllerRef.current = null
      }
    },
    []
  )

  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    dispatch({ type: 'CANCEL' })
  }, [])

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return {
    state,
    startAnalysis,
    cancelAnalysis,
    resetState,
    isActive: isStateActive(state),
  }
}

export { useStreamingAnalysis }

export function AnalysisJobCenter() {
  const [open, setOpen] = useState(true)
  const jobs = useResearchStore((s) => s.jobs)
  const jobOrder = useResearchStore((s) => s.jobOrder)
  const setActiveJob = useResearchStore((s) => s.setActiveJob)
  const retryJob = useResearchStore((s) => s.retryJob)
  const cancelJob = useResearchStore((s) => s.cancelJob)

  const list = useMemo(
    () => jobOrder.map((id) => jobs[id]).filter(Boolean),
    [jobOrder, jobs]
  )

  const activeCount = list.filter((job) => isJobActive(job)).length
  if (list.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[90vw]">
      <div className="rounded-xl border border-border bg-card shadow-lg">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="flex items-center gap-2">
            분석 작업
            {activeCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />
                {activeCount}
              </span>
            )}
          </span>
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
        {open && (
          <div className="max-h-[360px] overflow-auto border-t border-border">
            <ul className="divide-y divide-border">
              {list.slice(0, 6).map((job) => (
                <li key={job.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/results?keyword=${encodeURIComponent(job.keyword)}&country=${encodeURIComponent(job.country_code || 'KR')}`}
                          onClick={() => void setActiveJob(job.id)}
                          className="truncate font-medium text-foreground hover:text-primary"
                        >
                          {job.keyword}
                        </Link>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            getStatusColor(job.status)
                          )}
                        >
                          {statusLabel[job.status] ?? job.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {isJobActive(job) && (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        )}
                        {job.progress_step
                          ? legacyStepLabel[job.progress_step] ?? job.progress_step
                          : '대기'}
                      </div>
                      {job.error && (
                        <div className="mt-1 text-xs text-red-500 line-clamp-2">
                          {job.error}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {job.status === 'failed' && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => void retryJob(job.id)}
                          aria-label="재시도"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </button>
                      )}
                      {isJobActive(job) && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => void cancelJob(job.id)}
                          aria-label="취소"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Streaming analysis status display component.
 * Used for new streaming-based analysis flow.
 */
export function StreamingAnalysisStatus({
  state,
  keyword,
  onCancel,
}: {
  state: AnalysisDisplayState
  keyword: string
  onCancel?: () => void
}) {
  if (state.status === 'idle') return null

  const progressLabel = getProgressLabel(state)

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{keyword}</span>
          <span className={cn('rounded-full px-2 py-0.5 text-xs', getStatusColor(state.status))}>
            {statusLabel[state.status]}
          </span>
        </div>
        {progressLabel && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {progressLabel}
          </div>
        )}
        {state.status === 'failed' && (
          <div className="mt-1 text-xs text-red-500">{state.error}</div>
        )}
      </div>
      {isStateActive(state) && onCancel && (
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={onCancel}
          aria-label="취소"
        >
          <Ban className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
