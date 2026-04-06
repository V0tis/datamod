'use client'

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, Loader2, X, History, ChevronRight, Target, Sparkles, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { getRandomRinMessage, RIN_LOADING_MESSAGES } from '@/components/common/RinAnimation'
import { AnalysisProgressOverlay } from '@/components/research/AnalysisProgressOverlay'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { fetchTrendsForCountry } from '@/lib/fetch-trends'
import type { TrendsResponse } from '@/lib/trends-types'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import { CountryChips, COUNTRY_CHIP_CODES, type CountryChipCode } from '@/components/country-chips'
import { getAnalysisActivityMessage, getProgressStepIndex, PROGRESS_STEPS } from '@/lib/analysis-activity-messages'
import { LandingPage } from '@/components/landing/landing-page'
import type { SavedInsight } from '@/lib/insights-types'
import type { DashboardKeywordRow } from '@/app/api/research/dashboard-recommendations/route'
import { DEPTH_LABELS, depthToApiMode, getDepthEstimates, formatEstimatedTime, type DepthMode } from '@/lib/analysis-estimates'
import { DecisionSummary, type DecisionSummaryData } from '@/components/dashboard/decision-summary'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardCardShell } from '@/components/dashboard/dashboard-card-shell'

const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'
const ANALYSIS_DEPTH_KEY = 'rin_analysis_depth'

function RinAISearchInner() {
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>(() => RIN_LOADING_MESSAGES[0])
  useEffect(() => {
    setLoadingMessage(getRandomRinMessage())
  }, [])
  const [recentReports, setRecentReports] = useState<{ keyword: string; created_at: string | null; country_code: string; opportunity_score?: number | null; analysis_status?: string | null }[]>([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
  const [dashboardRecs, setDashboardRecs] = useState<{ highOpportunity: DashboardKeywordRow[]; highRisk: DashboardKeywordRow[] }>({ highOpportunity: [], highRisk: [] })
  const [dashboardRecsLoading, setDashboardRecsLoading] = useState(false)
  const [savedInsights, setSavedInsights] = useState<SavedInsight[]>([])
  const [savedInsightsLoading, setSavedInsightsLoading] = useState(false)
  const [sharedTrends, setSharedTrends] = useState<TrendsResponse>({
    KR: [],
    US: [],
    JP: [],
    TW: [],
    HK: [],
    GB: [],
    DE: [],
    updatedAt: null,
  })
  const [trendsLoading, setTrendsLoading] = useState(false)
  const searchParams = useSearchParams()
  const [trendCountry, setTrendCountryState] = useState<CountryChipCode>('KR')
  useEffect(() => {
    const c = searchParams.get('country')
    if (c && (COUNTRY_CHIP_CODES as readonly string[]).includes(c)) {
      setTrendCountryState(c as CountryChipCode)
    } else {
      try {
        const saved = window.localStorage.getItem(TRENDS_COUNTRY_STORAGE_KEY)
        if (saved && (COUNTRY_CHIP_CODES as readonly string[]).includes(saved)) {
          setTrendCountryState(saved as CountryChipCode)
        }
      } catch {
        /* ignore */
      }
    }
  }, [searchParams])

  useEffect(() => {
    try {
      window.localStorage.setItem(TRENDS_COUNTRY_STORAGE_KEY, trendCountry)
    } catch {
      /* ignore */
    }
  }, [trendCountry])

  useEffect(() => {
    if (!searchParams.get('country') && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(TRENDS_COUNTRY_STORAGE_KEY)
      if (saved && (COUNTRY_CHIP_CODES as readonly string[]).includes(saved)) {
        router.replace(`/?country=${saved}`)
      }
    }
  }, [])

  const setTrendCountry = (code: CountryChipCode) => {
    setTrendCountryState(code)
    try {
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/?country=${code}`)
      }
    } catch {
      router.replace(`/?country=${code}`)
    }
  }
  const [canSearch, setCanSearch] = useState<boolean | null>(null)
  const [analysisDepth, setAnalysisDepth] = useState<DepthMode>('standard')
  /* 분석 깊이는 설정 API에서 로드함 (useEffect below). 로그인 전에는 기본값 'standard' */
  const depthEstimates = getDepthEstimates(analysisDepth)
  /** When true, we're navigating from trend click - keep main UI static, show overlay only */
  const [navigatingFromTrend, setNavigatingFromTrend] = useState(false)
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const abortAnalysis = useResearchStore((s) => s.abortAnalysis)
  const streamingState = useResearchStore((s) => s.streamingState)
  const currentAnalysisKeyword = useResearchStore((s) => s.keyword)
  const isAnalyzingNow = useResearchStore((s) => s.isAnalyzingNow)
  /** Use analysis UI only when searching from form; trend click should not change main page */
  const showAnalysisUI = (searching || isAnalyzingNow()) && !navigatingFromTrend

  const searchInputRef = useRef<HTMLInputElement>(null)

  const decisionSummaryData = useMemo((): DecisionSummaryData => {
    const top = dashboardRecs.highOpportunity[0]
    if (top) {
      return {
        recommendedKeyword: top.keyword,
        confidence: top.opportunity_score,
        confidenceLabel: `추천 신뢰도 ${top.opportunity_score}점`,
        reasons: [
          `완료된 분석 중 기회 점수가 가장 높은 키워드입니다 (${top.opportunity_score}점).`,
          `${top.analysis_count}건의 분석 결과가 이 시장 판단에 반영되었습니다.`,
        ],
        strategyHref: `/results?keyword=${encodeURIComponent(top.keyword)}&country=${encodeURIComponent(trendCountry)}`,
        source: 'opportunity',
      }
    }
    const trendList = sharedTrends[trendCountry] ?? []
    const t = trendList[0]
    if (t) {
      const hasTranslation = t.title_ko != null && t.title_ko !== t.keyword
      const displayLabel =
        trendCountry !== 'KR' && hasTranslation ? `${t.keyword} · ${t.title_ko}` : hasTranslation ? t.title_ko! : t.keyword
      return {
        recommendedKeyword: displayLabel,
        confidence: null,
        confidenceLabel: '트렌드 기반 제안',
        reasons: [
          `${trendCountry} 지역 급상승 트렌드 상위에 오른 주제입니다.`,
          '검색·뉴스 RSS 신호를 바탕으로 시장 관심이 빠르게 움직이는지 확인할 수 있습니다.',
        ],
        strategyHref: `/results?keyword=${encodeURIComponent(t.keyword)}&country=${encodeURIComponent(trendCountry)}`,
        source: 'trend',
      }
    }
    return {
      recommendedKeyword: null,
      confidence: null,
      confidenceLabel: '데이터 준비 중',
      reasons: [
        '상단 검색창에 시장 키워드를 입력하면 기회·리스크·전략을 한 번에 분석합니다.',
        '첫 분석이 끝나면 이 영역에 자동으로 추천이 표시됩니다.',
      ],
      strategyHref: null,
      source: 'empty',
    }
  }, [dashboardRecs.highOpportunity, sharedTrends, trendCountry])

  const decisionSummaryLoading =
    dashboardRecsLoading || (dashboardRecs.highOpportunity.length === 0 && trendsLoading)

  const scrollToSearchAndFocus = useCallback(() => {
    document.getElementById('dashboard-analysis')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => searchInputRef.current?.focus(), 300)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setCanSearch(null)
      return
    }
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { licenseOrigin?: { gemini: string }; canSearch?: boolean; analysisDepth?: string } | null) => {
        if (!data) return
        setCanSearch(typeof data.canSearch === 'boolean' ? data.canSearch : null)
        if (data.analysisDepth === 'fast' || data.analysisDepth === 'standard' || data.analysisDepth === 'deep') {
          setAnalysisDepth(data.analysisDepth)
          try {
            window.localStorage.setItem(ANALYSIS_DEPTH_KEY, data.analysisDepth)
          } catch {
            /* ignore */
          }
        }
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '설정 정보를 불러오지 못했습니다.' })
        setCanSearch(null)
      })
  }, [user])

  const fetchRecentReports = useCallback(() => {
    if (!user) {
      setRecentReports([])
      setRecentReportsLoading(false)
      return
    }
    setRecentReportsLoading(true)
    fetch('/api/research/history')
      .then((res) => res.json())
      .then((data: { list?: Array<{ keyword: string; updated_at?: string | null; country_code?: string; opportunity_score?: number | null; analysis_status?: string | null }> }) => {
        const list = data?.list ?? []
        setRecentReports(list.slice(0, 6).map((r) => ({
          keyword: r.keyword,
          created_at: r.updated_at ?? null,
          country_code: r.country_code ?? 'KR',
          opportunity_score: r.opportunity_score ?? null,
          analysis_status: r.analysis_status ?? null,
        })))
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '최근 리서치 기록을 불러오지 못했습니다.' })
        setRecentReports([])
      })
      .finally(() => setRecentReportsLoading(false))
  }, [user])

  const fetchDashboardRecommendations = useCallback(() => {
    if (!user) {
      setDashboardRecs({ highOpportunity: [], highRisk: [] })
      setDashboardRecsLoading(false)
      return
    }
    setDashboardRecsLoading(true)
    fetch('/api/research/dashboard-recommendations')
      .then((res) => res.json())
      .then((data: { highOpportunity?: DashboardKeywordRow[]; highRisk?: DashboardKeywordRow[] }) => {
        setDashboardRecs({
          highOpportunity: Array.isArray(data?.highOpportunity) ? data.highOpportunity : [],
          highRisk: Array.isArray(data?.highRisk) ? data.highRisk : [],
        })
      })
      .catch(() => setDashboardRecs({ highOpportunity: [], highRisk: [] }))
      .finally(() => setDashboardRecsLoading(false))
  }, [user])

  useEffect(() => {
    fetchRecentReports()
  }, [fetchRecentReports])

  useEffect(() => {
    fetchDashboardRecommendations()
  }, [fetchDashboardRecommendations])

  const fetchSavedInsights = useCallback(() => {
    if (!user) {
      setSavedInsights([])
      setSavedInsightsLoading(false)
      return
    }
    setSavedInsightsLoading(true)
    fetch('/api/insights')
      .then((res) => res.json())
      .then((data: { list?: SavedInsight[] }) => {
        setSavedInsights((data.list ?? []).slice(0, 8))
      })
      .catch(() => setSavedInsights([]))
      .finally(() => setSavedInsightsLoading(false))
  }, [user])

  useEffect(() => {
    fetchSavedInsights()
  }, [fetchSavedInsights])

  useEffect(() => {
    if (!user) return
    let lastRefresh = Date.now()
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastRefresh < 30_000) return
      lastRefresh = Date.now()
      fetchRecentReports()
      fetchSavedInsights()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [user, fetchRecentReports, fetchSavedInsights, fetchDashboardRecommendations])

  const fetchTrends = (forceRefresh = false) => {
    setTrendsLoading(true)
    fetchTrendsForCountry(trendCountry, { refresh: forceRefresh })
      .then(({ items, updatedAt, refreshed, refreshFailed }) => {
        setSharedTrends((prev) => ({
          ...prev,
          [trendCountry]: items,
          updatedAt: updatedAt ?? prev.updatedAt ?? null,
        }))
        if (refreshed) toast.success('데이터가 최신 상태로 업데이트되었습니다')
        if (refreshFailed) toast.warning('일시적 오류로 갱신에 실패했습니다. 기존 데이터를 표시합니다.')
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 데이터를 불러오지 못했습니다.' }))
      .finally(() => setTrendsLoading(false))
  }

  useEffect(() => {
    fetchTrends(false)
  }, [trendCountry])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const k = query.trim()
    if (!k) {
      setError('검색어를 입력해 주세요.')
      return
    }
    if (isAnalyzingNow()) {
      toast.warning('이미 분석이 진행 중입니다.')
      return
    }
    setError(null)
    setSearching(true)
    startStreamingResearch(k, { country_code: trendCountry, mode: depthToApiMode(analysisDepth) })
    if (user) {
      try {
        const reportRes = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k }),
        })
        if (reportRes.ok) {
          const now = new Date().toISOString()
          setRecentReports((prev) => [{ keyword: k, created_at: now, country_code: trendCountry, opportunity_score: null, analysis_status: 'analyzing' }, ...prev.filter((r) => r.keyword !== k)].slice(0, 6))
          fetch('/api/research/history')
            .then((res) => res.json())
      .then((data: { list?: Array<{ keyword: string; updated_at?: string | null; country_code?: string; opportunity_score?: number | null; analysis_status?: string | null }> }) => {
        const list = data?.list ?? []
        setRecentReports(list.slice(0, 6).map((r) => ({
          keyword: r.keyword,
          created_at: r.updated_at ?? null,
          country_code: r.country_code ?? 'KR',
          opportunity_score: r.opportunity_score ?? null,
          analysis_status: r.analysis_status ?? null,
        })))
      })
            .catch(() => {})
        } else {
          const err = await reportRes.json().catch(() => ({}))
          toast.error(err?.error ?? '검색 기록 저장에 실패했습니다.')
        }
      } catch {
        toast.error('검색 기록 저장에 실패했습니다.')
      }
    }
    router.push(`/results?keyword=${encodeURIComponent(k)}&country=${encodeURIComponent(trendCountry)}`)
  }

  const handleAbort = () => {
    abortAnalysis()
    setSearching(false)
  }

  const progressStepIndex = getProgressStepIndex(
    streamingState.status === 'running' || streamingState.status === 'streaming' ? (streamingState as { stepId?: string }).stepId : undefined,
    'currentStep' in streamingState ? streamingState.currentStep : 0
  )
  const [stepStartTime, setStepStartTime] = useState(() => Date.now())
  const [tickTime, setTickTime] = useState(() => Date.now())
  useEffect(() => {
    if (showAnalysisUI) setStepStartTime(Date.now())
  }, [progressStepIndex, showAnalysisUI])
  useEffect(() => {
    if (!showAnalysisUI) return
    const id = setInterval(() => setTickTime(Date.now()), 2000)
    return () => clearInterval(id)
  }, [showAnalysisUI])
  const stepElapsedMs = showAnalysisUI ? tickTime - stepStartTime : 0

  const getButtonLabel = () => {
    if (showAnalysisUI) {
      const state = streamingState
      if (state.status === 'running' || state.status === 'streaming') {
        return `분석 중... (${progressStepIndex + 1}/${PROGRESS_STEPS.length})`
      }
      return '분석 중...'
    }
    return '시장 분석 시작'
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }
  if (user === null) {
    return <LandingPage />
  }

  const trendItems = (sharedTrends[trendCountry] ?? []).slice(0, 10)

  return (
    <div className="min-h-screen bg-background relative">
      {navigatingFromTrend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" aria-label="이동 중">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">분석 페이지로 이동 중...</p>
          </div>
        </div>
      )}
      <AnimatePresence mode="wait">
        {searching && !navigatingFromTrend ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnalysisProgressOverlay
              variant="overlay"
              stepId={streamingState.status === 'running' || streamingState.status === 'streaming' ? (streamingState as { stepId?: string }).stepId : undefined}
              currentStep={'currentStep' in streamingState ? streamingState.currentStep : 0}
              isRunning={streamingState.status === 'running' || streamingState.status === 'streaming'}
              keyword={currentAnalysisKeyword || query}
              showAnimation
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-[calc(100vh-3.5rem)] overflow-y-auto"
          >
            <DashboardLayout>
            {(error != null || (user && canSearch === false)) && (
              <div className="flex flex-col gap-3">
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {user && canSearch === false && (
                  <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-amber-800 dark:text-amber-400">Gemini API 키를 등록하면 분석을 사용할 수 있습니다.</p>
                    <Link href="/settings?tab=license" className="shrink-0">
                      <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-800 dark:text-amber-400 hover:bg-amber-500/10">
                        키 등록
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            <DecisionSummary
              loading={decisionSummaryLoading}
              data={decisionSummaryData}
              startDisabled={showAnalysisUI}
              onStartAnalysis={() => {
                const top = dashboardRecs.highOpportunity[0]
                if (top) {
                  setQuery(top.keyword)
                  setError(null)
                } else {
                  const t = (sharedTrends[trendCountry] ?? [])[0]
                  if (t) {
                    setQuery(t.keyword)
                    setError(null)
                  }
                }
                scrollToSearchAndFocus()
              }}
            />

            <DashboardCardShell
              id="dashboard-analysis"
              icon={<Sparkles className="h-5 w-5 text-primary" aria-hidden />}
              title="시장 키워드 입력"
              description="키워드를 입력하면 AI가 기회·경쟁·전략을 한 번에 분석합니다. 예시 칩을 눌러 바로 채울 수 있습니다."
              footer={
                !showAnalysisUI ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    다음 단계: 키워드 확정 → <span className="font-medium text-foreground/80">분석 시작</span> → 결과에서 전략·액션 플랜 확인
                  </p>
                ) : undefined
              }
            >
                <form onSubmit={handleSearch} className="space-y-4">
                  <div
                    className={cn(
                      'relative flex items-center rounded-xl border border-border bg-background/80 shadow-sm h-12 sm:h-14 px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 focus-within:shadow-md transition-all',
                      showAnalysisUI && 'opacity-70'
                    )}
                  >
                    <Sparkles className="h-5 w-5 text-primary/50 shrink-0 mr-3" />
                    <Input
                      ref={searchInputRef}
                      type="search"
                      aria-label="분석할 시장 키워드"
                      placeholder="예: AI 작성 도구, 리모트워크 SaaS, 에듀테크 플랫폼..."
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setError(null) }}
                      disabled={showAnalysisUI}
                      className="border-0 bg-transparent pl-0 pr-28 h-full py-0 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {(searching || isAnalyzingNow()) ? (
                        <Button type="button" variant="destructive" onClick={handleAbort} size="sm" className="h-9 px-4 text-sm font-medium rounded-lg">
                          <X className="h-3.5 w-3.5 mr-1.5" />중단
                        </Button>
                      ) : (
                        <Button type="submit" disabled={!query.trim()} size="sm" className="h-9 px-5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90">
                          분석 시작
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground">분석 깊이</span>
                    {(['fast', 'standard', 'deep'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setAnalysisDepth(d)
                          try { window.localStorage.setItem(ANALYSIS_DEPTH_KEY, d) } catch { /* ignore */ }
                          fetch('/api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ analysis_depth: d }),
                          }).catch(() => { /* 설정 저장 실패 시 무시 */ })
                        }}
                        disabled={showAnalysisUI}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40',
                          analysisDepth === d
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground'
                        )}
                      >
                        {DEPTH_LABELS[d]}
                      </button>
                    ))}
                  </div>
                  {!showAnalysisUI && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>예상 시간 {formatEstimatedTime(depthEstimates.estimatedTimeSec)}</span>
                      <span>예상 토큰 약 {(depthEstimates.estimatedTokens / 1000).toFixed(0)}K</span>
                    </div>
                  )}
                  <div className="space-y-2 pt-1">
                    <p className="text-xs font-medium text-muted-foreground">빠른 시작 · 예시 키워드</p>
                    <div className="flex flex-wrap gap-2">
                      {['AI 작성 도구', '리모트워크 SaaS', '푸드테크', '에듀테크 플랫폼', '건강 모니터링', '전동킥보드 공유', 'B2B 결제', '클린뷰티 D2C'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setQuery(k); setError(null); searchInputRef.current?.focus() }}
                          disabled={showAnalysisUI}
                          className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground/90 hover:border-primary/35 hover:bg-muted transition-colors disabled:opacity-40"
                        >
                          {k}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>

                {showAnalysisUI && streamingState.status !== 'idle' && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <p className="text-sm font-medium text-foreground flex-1">
                        {(streamingState.status === 'running' || streamingState.status === 'streaming')
                          ? getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep, {
                          elapsedMs: stepElapsedMs,
                          currentArticleTitle: (streamingState as { currentArticleTitle?: string }).currentArticleTitle,
                        })
                          : getButtonLabel()}
                      </p>
                      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                        {(streamingState.status === 'running' || streamingState.status === 'streaming') && typeof streamingState.currentStep === 'number'
                          ? `${progressStepIndex + 1}/${PROGRESS_STEPS.length}`
                          : ''}
                      </span>
                    </div>
                    {(streamingState.status === 'running' || streamingState.status === 'streaming') && (
                      <div className="h-2 bg-muted/60 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, ((progressStepIndex + 1) / PROGRESS_STEPS.length) * 100)}%` }} />
                      </div>
                    )}
                  </div>
                )}
            </DashboardCardShell>

            <section className="space-y-4" aria-labelledby="dash-opportunity-heading">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p id="dash-opportunity-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    시장 신호
                  </p>
                  <p className="text-sm text-muted-foreground">
                    우선 검토할 키워드를 고르세요. 행을 누르면 결과로 이동하고, 하단에서 심층 분석을 이어갈 수 있습니다.
                  </p>
                </div>
                <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-auto" asChild>
                  <Link href="/history">기록에서 고르기</Link>
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DashboardCardShell
                  icon={<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />}
                  title="기회 높은 시장"
                  description="완료된 분석에서 기회 점수가 높게 나온 키워드입니다."
                  footer={
                    dashboardRecs.highOpportunity.length > 0 ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button className="w-full sm:w-auto" asChild>
                          <Link href={`/results?keyword=${encodeURIComponent(dashboardRecs.highOpportunity[0].keyword)}&country=${encodeURIComponent(trendCountry)}`}>
                            상위 키워드 심층 분석
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto" asChild>
                          <Link
                            href={`/results?keyword=${encodeURIComponent(dashboardRecs.highOpportunity[0].keyword)}&country=${encodeURIComponent(trendCountry)}#section-strategic-recommendations`}
                          >
                            전략만 보기
                          </Link>
                        </Button>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="space-y-3">
                    {dashboardRecsLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-lg bg-white/60 dark:bg-white/5 h-12 animate-pulse" />
                      ))
                    ) : dashboardRecs.highOpportunity.length === 0 ? (
                      <div className="rounded-xl bg-muted/20 border border-dashed border-border py-8 px-4 text-center space-y-3">
                        <Target className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground">완료된 분석이 쌓이면 기회 상위 키워드가 여기 표시됩니다.</p>
                        <Button type="button" variant="secondary" size="sm" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                          첫 분석 시작하기
                        </Button>
                      </div>
                    ) : (
                      dashboardRecs.highOpportunity.slice(0, 4).map((row, i) => (
                          <Link
                            key={`opp-${row.keyword}-${i}`}
                            href={`/results?keyword=${encodeURIComponent(row.keyword)}&country=${encodeURIComponent(trendCountry)}#section-strategic-recommendations`}
                            className="group flex items-start gap-3 rounded-lg border border-border/80 bg-background/50 px-4 py-3 transition-colors hover:bg-muted/30"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">키워드</span>
                                <span className="truncate text-sm font-semibold text-foreground">{row.keyword}</span>
                              </div>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                왜: 집계된 분석에서 기회 점수가 높습니다. {row.analysis_count}건의 완료 분석이 반영되었습니다.
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xs text-muted-foreground">기회 점수</span>
                              <span className="text-base font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{row.opportunity_score}</span>
                              <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600" aria-hidden />
                            </div>
                          </Link>
                        ))
                    )}
                  </div>
                </DashboardCardShell>

                <DashboardCardShell
                  icon={<AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden />}
                  title="리스크 높은 시장"
                  description="경쟁·포화 신호가 강한 키워드입니다. 진입 전 검증을 권장합니다."
                  footer={
                    dashboardRecs.highRisk.length > 0 ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button className="w-full sm:w-auto" asChild>
                          <Link href={`/results?keyword=${encodeURIComponent(dashboardRecs.highRisk[0].keyword)}&country=${encodeURIComponent(trendCountry)}`}>
                            리스크 시장 재분석
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto" asChild>
                          <Link
                            href={`/results?keyword=${encodeURIComponent(dashboardRecs.highRisk[0].keyword)}&country=${encodeURIComponent(trendCountry)}#section-competitor-landscape`}
                          >
                            경쟁 환경만 보기
                          </Link>
                        </Button>
                      </div>
                    ) : undefined
                  }
                >
                  <div className="space-y-3">
                    {dashboardRecsLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-lg bg-white/60 dark:bg-white/5 h-12 animate-pulse" />
                      ))
                    ) : dashboardRecs.highRisk.length === 0 ? (
                      <div className="rounded-xl bg-muted/20 border border-dashed border-border py-8 px-4 text-center space-y-3">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                        <p className="text-sm text-muted-foreground">리스크 지표가 의미 있게 쌓이면 경쟁·포화 신호가 여기 표시됩니다.</p>
                        <Button type="button" variant="secondary" size="sm" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                          시장 분석으로 데이터 쌓기
                        </Button>
                      </div>
                    ) : (
                      dashboardRecs.highRisk.slice(0, 4).map((row, i) => (
                          <Link
                            key={`risk-${row.keyword}-${i}`}
                            href={`/results?keyword=${encodeURIComponent(row.keyword)}&country=${encodeURIComponent(trendCountry)}#section-competitor-landscape`}
                            className="group flex items-start gap-3 rounded-lg border border-border/80 bg-background/50 px-4 py-3 transition-colors hover:bg-muted/30"
                          >
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">키워드</span>
                                <span className="truncate text-sm font-semibold text-foreground">{row.keyword}</span>
                              </div>
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                왜: 전략 평가에서 경쟁 리스크 지표가 높게 나온 키워드입니다. 진입 장벽·포지셔닝을 결과에서 먼저 확인하세요.
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xs text-muted-foreground">리스크 점수</span>
                              <span className="text-base font-bold tabular-nums text-red-600 dark:text-red-400">{row.risk_score}</span>
                              <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground/50 group-hover:text-red-600" aria-hidden />
                            </div>
                          </Link>
                        ))
                    )}
                  </div>
                </DashboardCardShell>
              </div>
            </section>

            <section aria-labelledby="dash-trends-heading">
              <DashboardCardShell
                titleId="dash-trends-heading"
                emphasis="subtle"
                icon={<TrendingUp className="h-5 w-5 text-primary" aria-hidden />}
                title="급상승 트렌드"
                description="RSS·검색 트렌드 피드 기준입니다. 행마다 분석을 눌러 수요·경쟁 신호를 확인하세요."
                headerRight={
                  <div className="flex flex-wrap items-center gap-2">
                    <CountryChips value={trendCountry} onChange={setTrendCountry} compact />
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/trends">트렌드 허브</Link>
                    </Button>
                  </div>
                }
                footer={
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    출처: RSS·트렌드 피드 · 약 1시간 캐시. 다음 단계: 관심 키워드에서 <span className="font-medium text-foreground/80">분석</span> 실행.
                  </p>
                }
              >
                <div className="max-h-[280px] overflow-auto rounded-lg border border-border/60 bg-background/40 -mx-1">
                  {trendsLoading ? (
                    <div className="space-y-2 p-4">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="h-12 animate-pulse rounded-xl bg-muted/50" />
                      ))}
                    </div>
                  ) : trendItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center space-y-3 px-4 py-12 text-center">
                      <TrendingUp className="h-8 w-8 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">이 지역에 표시할 트렌드가 없습니다.</p>
                      <Button type="button" variant="secondary" size="sm" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                        직접 키워드 분석
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {trendItems.map((item, i) => {
                        const hasTranslation = item.title_ko != null && item.title_ko !== item.keyword
                        const showBoth = trendCountry !== 'KR' && hasTranslation
                        const displayName = showBoth ? `${item.keyword} · ${item.title_ko}` : hasTranslation ? item.title_ko! : item.keyword
                        const subLabel = item.search_volume ?? (item.rank ? `#${item.rank}` : null)
                        const runAnalysis = () => {
                          const originalKeyword = item.keyword
                          const translatedKeyword = item.title_ko && item.title_ko !== item.keyword ? item.title_ko : undefined
                          setNavigatingFromTrend(true)
                          const params = new URLSearchParams({ keyword: originalKeyword, country: trendCountry })
                          if (translatedKeyword) params.set('keywordTranslated', translatedKeyword)
                          router.push(`/results?${params.toString()}`)
                          startStreamingResearch(originalKeyword, { country_code: trendCountry })
                        }
                        return (
                          <div
                            key={`${trendCountry}-${item.keyword}-${i}`}
                            className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <span className="w-6 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted-foreground">{i + 1}</span>
                              <div className="min-w-0 flex-1 space-y-1">
                                <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                  급상승 트렌드에 오른 주제입니다. 한 번의 분석으로 수요와 경쟁 구도를 함께 봅니다.
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground/85">
                                  {subLabel != null && subLabel !== '' && <span className="tabular-nums">{subLabel}</span>}
                                  {item.started_at && (
                                    <span className="tabular-nums">
                                      <TimeAgo isoString={item.started_at} />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center pl-9 sm:pl-0">
                              <Button type="button" size="sm" className="w-full font-semibold sm:w-auto" onClick={runAnalysis} disabled={showAnalysisUI}>
                                분석
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </DashboardCardShell>
            </section>

            <section aria-labelledby="dash-recent-heading">
              <DashboardCardShell
                titleId="dash-recent-heading"
                emphasis="subtle"
                icon={<History className="h-5 w-5 text-muted-foreground" aria-hidden />}
                title="최근 분석"
                description="방금 다룬 키워드입니다. 이어서 보거나 새 분석으로 넘어가세요."
                headerRight={
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary" asChild>
                    <Link href="/history">전체 기록</Link>
                  </Button>
                }
                footer={
                  recentReports.length > 0 ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs text-muted-foreground">다음 단계: 항목을 열어 요약을 확인하거나, 새 키워드로 분석을 이어가세요.</p>
                      <Button type="button" variant="default" size="sm" className="shrink-0 self-start sm:self-auto" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                        새 분석
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                <div className="max-h-[260px] overflow-auto rounded-lg border border-border/60 bg-background/40 -mx-1">
                  {recentReportsLoading ? (
                    <div className="space-y-2 p-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/50" />
                      ))}
                    </div>
                  ) : recentReports.length > 0 ? (
                    <div className="divide-y divide-border/60">
                      {recentReports.map((r, i) => (
                        <Link
                          key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}
                          href={`/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`}
                          className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/25"
                        >
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                            {r.keyword}
                          </span>
                          {r.opportunity_score != null && r.analysis_status !== 'analyzing' && (
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                              {r.opportunity_score}
                            </span>
                          )}
                          {r.analysis_status === 'analyzing' &&
                            (() => {
                              const isCurrent = (r.keyword?.trim() ?? '') === (currentAnalysisKeyword?.trim() ?? '')
                              const hasStep = isCurrent && (streamingState.status === 'running' || streamingState.status === 'streaming')
                              const stepNum = hasStep ? (streamingState.currentStep ?? 0) + 1 : 1
                              return (
                                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  {stepNum}/{PROGRESS_STEPS.length}
                                </span>
                              )
                            })()}
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground/80">
                            <TimeAgo isoString={r.created_at} />
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/45 transition-colors group-hover:text-foreground" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-3 px-4 py-12 text-center">
                      <History className="h-8 w-8 text-muted-foreground/25" />
                      <p className="text-sm text-muted-foreground">분석 기록이 없습니다</p>
                      <p className="text-xs text-muted-foreground">키워드를 입력하고 첫 분석을 실행해 보세요.</p>
                      <Button type="button" size="sm" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                        지금 분석 시작
                      </Button>
                    </div>
                  )}
                </div>
              </DashboardCardShell>
            </section>
            </DashboardLayout>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function RinAISearch() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      </div>
    }>
      <RinAISearchInner />
    </Suspense>
  )
}
