'use client'

import React, { Suspense, useState, useEffect, useCallback } from 'react'
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
  const jobs = useResearchStore((s) => s.jobs)
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const abortAnalysis = useResearchStore((s) => s.abortAnalysis)
  const streamingState = useResearchStore((s) => s.streamingState)
  const currentAnalysisKeyword = useResearchStore((s) => s.keyword)
  const isAnalyzingNow = useResearchStore((s) => s.isAnalyzingNow)
  /** Use analysis UI only when searching from form; trend click should not change main page */
  const showAnalysisUI = (searching || isAnalyzingNow()) && !navigatingFromTrend

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
  const [, setTick] = useState(0)
  useEffect(() => {
    if (showAnalysisUI) setStepStartTime(Date.now())
  }, [progressStepIndex, showAnalysisUI])
  useEffect(() => {
    if (!showAnalysisUI) return
    const id = setInterval(() => setTick((n) => n + 1), 2000)
    return () => clearInterval(id)
  }, [showAnalysisUI])
  const stepElapsedMs = showAnalysisUI ? Date.now() - stepStartTime : 0

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
            className="flex flex-col px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1200px] mx-auto overflow-y-auto min-h-[calc(100vh-3.5rem)]"
          >
            {/* ── Alerts ── */}
            {error && (
              <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm shrink-0">
                {error}
              </div>
            )}
            {user && canSearch === false && (
              <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 flex items-center justify-between gap-2 shrink-0">
                <p className="text-amber-700 dark:text-amber-400 text-sm">Gemini API 키를 등록하면 분석을 사용할 수 있습니다.</p>
                <Link href="/settings?tab=license" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 h-8 text-xs">키 등록</Button>
                </Link>
              </div>
            )}

            {/* ══════ 1. HERO ══════ */}
            <section
              id="dashboard-analysis"
              className="relative rounded-2xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden mb-8"
            >
              <div className="relative px-6 sm:px-8 py-8 sm:py-10">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-1">어떤 시장을 분석할까요?</h1>
                <p className="text-base text-muted-foreground font-normal mb-6">키워드를 입력하면 AI가 시장 기회, 경쟁 환경, 전략을 분석합니다</p>

                <form onSubmit={handleSearch}>
                  <div
                    className={cn(
                      'relative flex items-center rounded-xl border border-border bg-background/80 shadow-sm h-12 sm:h-14 px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 focus-within:shadow-md transition-all',
                      showAnalysisUI && 'opacity-70'
                    )}
                  >
                    <Sparkles className="h-5 w-5 text-primary/50 shrink-0 mr-3" />
                    <Input
                      type="search"
                      aria-label="분석할 시장 키워드"
                      placeholder="예: AI 작성 도구, 리모트워크 SaaS, 에듀테크 플랫폼..."
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setError(null) }}
                      disabled={showAnalysisUI}
                      className="border-0 bg-transparent pl-0 pr-28 h-full py-0 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
                    />
                    {query.length > 0 && !showAnalysisUI && (
                      <button type="button" onClick={() => setQuery('')} className="absolute right-24 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors" aria-label="검색어 지우기">
                        <X className="h-4 w-4" />
                      </button>
                    )}
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
                  <div className="flex flex-wrap items-center gap-3 mt-4">
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
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>예상 시간 {formatEstimatedTime(depthEstimates.estimatedTimeSec)}</span>
                      <span>예상 토큰 약 {(depthEstimates.estimatedTokens / 1000).toFixed(0)}K</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {['AI 작성 도구', '리모트워크 SaaS', '푸드테크', '에듀테크 플랫폼', '건강 모니터링', '전동킥보드 공유'].map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => { setQuery(k); setError(null) }}
                        disabled={showAnalysisUI}
                        className="rounded-lg border border-border/60 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors disabled:opacity-40"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </form>

                {showAnalysisUI && streamingState.status !== 'idle' && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <p className="text-sm font-medium text-foreground flex-1">
                        {(streamingState.status === 'running' || streamingState.status === 'streaming')
                          ? getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep, { elapsedMs: stepElapsedMs })
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
              </div>
            </section>

            {/* ══════ 2. RECOMMENDED MARKETS (배민 스타일: 파스텔 카드 + 아이콘 우상단 + 파란 CTA) ══════ */}
            <section className="mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 기회 높은 시장 */}
                <div className="relative rounded-2xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden min-h-[200px]">
                  <div className="absolute top-4 right-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="h-7 w-7" strokeWidth={2} />
                  </div>
                  <div className="px-5 pt-5 pb-4">
                    <h2 className="text-lg font-bold text-foreground pr-14">기회 높은 시장</h2>
                    <p className="text-sm text-muted-foreground mt-1">기회 점수가 높은 키워드예요. 실제 분석 기반으로 추천해요.</p>
                  </div>
                  <div className="px-5 pb-4 space-y-2">
                    {dashboardRecsLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-lg bg-white/60 dark:bg-white/5 h-12 animate-pulse" />
                      ))
                    ) : dashboardRecs.highOpportunity.length === 0 ? (
                      <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-border/60 py-8 text-center">
                        <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">분석 데이터가 쌓이면 여기에 추천이 표시돼요</p>
                      </div>
                    ) : (
                      <>
                        {dashboardRecs.highOpportunity.slice(0, 4).map((row, i) => (
                          <Link
                            key={`opp-${row.keyword}-${i}`}
                            href={`/results?keyword=${encodeURIComponent(row.keyword)}`}
                            className="flex items-center gap-3 rounded-lg bg-white/80 dark:bg-white/10 border border-white/80 dark:border-white/10 px-4 py-2.5 hover:bg-white dark:hover:bg-white/20 transition-colors group"
                          >
                            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{row.keyword}</span>
                            <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">기회 {row.opportunity_score}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-emerald-600 shrink-0" />
                          </Link>
                        ))}
                        {dashboardRecs.highOpportunity.length > 0 && (
                          <Link
                            href={`/results?keyword=${encodeURIComponent(dashboardRecs.highOpportunity[0].keyword)}`}
                            className="mt-3 flex justify-center"
                          >
                            <span className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                              기회 시장 분석하기
                            </span>
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {/* 리스크 높은 시장 */}
                <div className="relative rounded-2xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden min-h-[200px]">
                  <div className="absolute top-4 right-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-7 w-7" strokeWidth={2} />
                  </div>
                  <div className="px-5 pt-5 pb-4">
                    <h2 className="text-lg font-bold text-foreground pr-14">리스크 높은 시장</h2>
                    <p className="text-sm text-muted-foreground mt-1">리스크 점수가 높은 키워드예요. 모니터링을 추천해요.</p>
                  </div>
                  <div className="px-5 pb-4 space-y-2">
                    {dashboardRecsLoading ? (
                      [...Array(3)].map((_, i) => (
                        <div key={i} className="rounded-lg bg-white/60 dark:bg-white/5 h-12 animate-pulse" />
                      ))
                    ) : dashboardRecs.highRisk.length === 0 ? (
                      <div className="rounded-xl bg-white/60 dark:bg-white/5 border border-border/60 py-8 text-center">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">분석 데이터가 쌓이면 여기에 추천이 표시돼요</p>
                      </div>
                    ) : (
                      <>
                        {dashboardRecs.highRisk.slice(0, 4).map((row, i) => (
                          <Link
                            key={`risk-${row.keyword}-${i}`}
                            href={`/results?keyword=${encodeURIComponent(row.keyword)}`}
                            className="flex items-center gap-3 rounded-lg bg-white/80 dark:bg-white/10 border border-white/80 dark:border-white/10 px-4 py-2.5 hover:bg-white dark:hover:bg-white/20 transition-colors group"
                          >
                            <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{row.keyword}</span>
                            <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400 shrink-0">리스크 {row.risk_score}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-red-600 shrink-0" />
                          </Link>
                        ))}
                        {dashboardRecs.highRisk.length > 0 && (
                          <Link
                            href={`/results?keyword=${encodeURIComponent(dashboardRecs.highRisk[0].keyword)}`}
                            className="mt-3 flex justify-center"
                          >
                            <span className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                              리스크 시장 분석하기
                            </span>
                          </Link>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* ══════ 3. TRENDING ══════ */}
            <section className="mb-8">
              <div className="rounded-2xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      급상승 트렌드
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">최근 트렌드 키워드예요</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CountryChips value={trendCountry} onChange={setTrendCountry} compact />
                    <Link href="/trends" className="text-sm font-medium text-primary hover:underline">전체</Link>
                  </div>
                </div>
                <div className="max-h-[280px] overflow-auto">
                  {trendsLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="h-12 bg-muted/40 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : trendItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <TrendingUp className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">트렌드 데이터가 없습니다</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                      {trendItems.map((item, i) => {
                        const hasTranslation = item.title_ko != null && item.title_ko !== item.keyword
                        const showBoth = trendCountry !== 'KR' && hasTranslation
                        const displayName = showBoth ? `${item.keyword} · ${item.title_ko}` : hasTranslation ? item.title_ko! : item.keyword
                        const subLabel = item.search_volume ?? (item.rank ? `#${item.rank}` : null)
                        return (
                          <button
                            key={`${trendCountry}-${item.keyword}-${i}`}
                            type="button"
                            onClick={() => {
                              const originalKeyword = item.keyword
                              const translatedKeyword = item.title_ko && item.title_ko !== item.keyword ? item.title_ko : undefined
                              setNavigatingFromTrend(true)
                              const params = new URLSearchParams({ keyword: originalKeyword, country: trendCountry })
                              if (translatedKeyword) params.set('keywordTranslated', translatedKeyword)
                              router.push(`/results?${params.toString()}`)
                              startStreamingResearch(originalKeyword, { country_code: trendCountry })
                            }}
                            className="group flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-blue-500/5 transition-colors"
                          >
                            <span className="text-xs font-medium text-muted-foreground tabular-nums w-6 shrink-0">{i + 1}</span>
                            <span className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{displayName}</span>
                            {subLabel && <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0">{subLabel}</span>}
                            {item.started_at && <span className="text-xs text-muted-foreground/50 shrink-0"><TimeAgo isoString={item.started_at} /></span>}
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-blue-500 transition-colors shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="px-5 py-2 border-t border-border bg-muted/30 dark:bg-muted/20">
                  <p className="text-xs text-muted-foreground">RSS·트렌드 기준 · 1시간 캐시</p>
                </div>
              </div>
            </section>

            {/* ══════ 4. RECENT ANALYSIS ══════ */}
            <section>
              <div className="rounded-2xl border border-border bg-white dark:bg-card shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      최근 분석
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">방금 분석한 키워드예요</p>
                  </div>
                  <Link href="/history" className="text-sm font-medium text-primary hover:underline">전체 보기</Link>
                </div>
                <div className="max-h-[260px] overflow-auto">
                  {recentReportsLoading ? (
                    <div className="p-4 space-y-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-14 bg-muted/40 rounded-xl animate-pulse" />
                      ))}
                    </div>
                  ) : recentReports.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {recentReports.map((r, i) => (
                        <Link
                          key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}
                          href={`/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`}
                          className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                        >
                          <span className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">{r.keyword}</span>
                          {r.opportunity_score != null && r.analysis_status !== 'analyzing' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">{r.opportunity_score}</span>
                          )}
                          {r.analysis_status === 'analyzing' && (() => {
                            const isCurrent = (r.keyword?.trim() ?? '') === (currentAnalysisKeyword?.trim() ?? '')
                            const hasStep = isCurrent && (streamingState.status === 'running' || streamingState.status === 'streaming')
                            const stepNum = hasStep ? (streamingState.currentStep ?? 0) + 1 : 1
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 shrink-0">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {stepNum}/{PROGRESS_STEPS.length}
                              </span>
                            )
                          })()}
                          <span className="text-xs text-muted-foreground/70 tabular-nums shrink-0"><TimeAgo isoString={r.created_at} /></span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <History className="h-8 w-8 text-muted-foreground/20 mb-2" />
                      <p className="text-sm text-muted-foreground">분석 기록이 없습니다</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">상단에서 첫 분석을 시작하세요</p>
                    </div>
                  )}
                </div>
              </div>
            </section>
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
