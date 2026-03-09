'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import type { ConsensusData } from '@/components/research/ConsensusInsight'

/** Result page explicit state machine */
export type ResultState = 'idle' | 'loading' | 'cached' | 'success' | 'fail'

export type InsightStatus = 'idle' | 'loading' | 'success' | 'fail'

const FALLBACK_INSIGHT = '분석 불가. 데이터가 부족합니다.'

export interface UseResultPageStateParams {
  keyword: string | null
  countryFromUrl: string
  displayResult: ResearchResponse | null
  displayStatus: string | null
  displayError: string | null
  canonicalStatus: string
  polledStatus: 'pending' | 'running' | 'completed' | 'failed' | null
  historyLoadDone: boolean
  hasCachedResult: boolean | null
  loading: boolean
  hasFailure: boolean
  needsRunAction: boolean
  isViewingActiveJob: boolean
}

export interface UseResultPageStateResult {
  resultState: ResultState
  /** Stable analysis data – never overwritten by fail. Use for display. */
  analysisData: ResearchResponse | null
  /** Insight (consensus) data – separate from analysis, never overwrite success with fail. */
  insightData: ConsensusData | null
  /** Insight API status – if fail, only insight section fails, not entire result. */
  insightStatus: InsightStatus
  setInsightData: (data: ConsensusData | null, options?: { force?: boolean }) => void
  setInsightStatus: (status: InsightStatus) => void
  /** Show "AI 인사이트 생성 중" only when resultState === 'loading' */
  isAnalysisLoading: boolean
  /** Cached keyword for skip-analysis check */
  cachedKeywordRef: React.MutableRefObject<string | null>
}

/**
 * Result page state machine.
 * - idle: no keyword
 * - loading: analysis request running
 * - cached: data exists in DB/cache, loading without AI
 * - success: analysis completed or cached data loaded
 * - fail: analysis failed
 */
export function useResultPageState(params: UseResultPageStateParams): UseResultPageStateResult {
  const {
    keyword,
    displayResult,
    displayStatus,
    canonicalStatus,
    polledStatus,
    historyLoadDone,
    hasCachedResult,
    loading,
    hasFailure,
    needsRunAction,
    isViewingActiveJob,
  } = params

  const [resultState, setResultState] = useState<ResultState>('idle')
  const [insightData, setInsightDataState] = useState<ConsensusData | null>(null)
  const [insightStatus, setInsightStatus] = useState<InsightStatus>('idle')
  const analysisDataRef = useRef<ResearchResponse | null>(null)
  const cachedKeywordRef = useRef<string | null>(null)
  const prevResultStateRef = useRef<ResultState>('idle')

  const hasKeyword = Boolean((keyword ?? '').trim())

  /** Never overwrite success analysis data with null/fail. Only use ref fallback when viewing active job. */
  const analysisData = isViewingActiveJob ? (displayResult ?? analysisDataRef.current) : displayResult

  if (displayResult && hasKeyword && isViewingActiveJob) {
    analysisDataRef.current = displayResult
    if (hasCachedResult) cachedKeywordRef.current = keyword?.trim() ?? null
  }
  if (!isViewingActiveJob) analysisDataRef.current = null

  /** Never overwrite success insight with fail/fallback */
  const setInsightData = useCallback((data: ConsensusData | null, options?: { force?: boolean }) => {
    setInsightDataState((prev) => {
      if (options?.force) return data
      if (!data) return prev
      const summary = data?.strategicSummary?.summary?.trim() ?? ''
      if (summary === FALLBACK_INSIGHT && prev?.strategicSummary?.summary?.trim() && prev.strategicSummary.summary !== FALLBACK_INSIGHT) return prev
      return data
    })
  }, [])

  useEffect(() => {
    if (!hasKeyword) {
      setResultState('idle')
      cachedKeywordRef.current = null
      return
    }

    if (loading || polledStatus === 'pending' || polledStatus === 'running') {
      setResultState('loading')
      return
    }

    if (hasFailure) {
      setResultState((s) => (s === 'success' ? 'success' : 'fail'))
      return
    }

    if (displayResult?.reportId) {
      setResultState(hasCachedResult === true && !historyLoadDone ? 'cached' : 'success')
      return
    }

    if (historyLoadDone && hasCachedResult === false && needsRunAction) {
      setResultState('idle')
      return
    }

    if (historyLoadDone && hasCachedResult === true && !displayResult?.reportId) {
      setResultState('cached')
      return
    }

    setResultState((s) => (s === 'success' ? 'success' : 'idle'))
  }, [
    hasKeyword,
    loading,
    hasFailure,
    displayResult?.reportId,
    historyLoadDone,
    hasCachedResult,
    needsRunAction,
    polledStatus,
  ])

  const isAnalysisLoading = resultState === 'loading'

  if (typeof window !== 'undefined' && resultState !== prevResultStateRef.current) {
    prevResultStateRef.current = resultState
    console.log('Result state:', resultState)
    console.log('Cache found:', params.hasCachedResult)
    console.log('Insight status:', insightStatus)
  }

  return {
    resultState,
    analysisData,
    insightData,
    insightStatus,
    setInsightData,
    setInsightStatus,
    isAnalysisLoading,
    cachedKeywordRef,
  }
}
