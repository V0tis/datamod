'use client'

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { getRandomDatamodMessage, DATAMOD_LOADING_MESSAGES } from '@/components/common/RinAnimation'
import { AnalysisProgressOverlay, useAnalysisTypewriter } from '@/components/research/AnalysisProgressOverlay'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { fetchTrendsForCountry } from '@/lib/fetch-trends'
import type { TrendsResponse } from '@/lib/trends-types'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { COUNTRY_CHIP_CODES, type CountryChipCode } from '@/components/country-chips'
import type { TrendItem } from '@/lib/trends-types'
import { getAnalysisActivityMessage, getProgressStepIndex, PROGRESS_STEPS } from '@/lib/analysis-activity-messages'
import { LandingPage } from '@/components/landing/landing-page'
import { FullPageBrandLoader } from '@/components/full-page-brand-loader'
import type { SavedInsight } from '@/lib/insights-types'
import type { DashboardKeywordRow } from '@/lib/types/dashboard-keyword-row'
import { depthToApiMode, type DepthMode } from '@/lib/analysis-estimates'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { dashboardPageBg } from '@/components/dashboard/dashboard-tokens'
import {
  DashboardScatterMatrixCard,
  DashboardTrendGrowthCard,
  DashboardTopOpportunitiesCard,
} from '@/components/dashboard/dashboard-market-intelligence'
import { DashboardRisingTrendsPanel } from '@/components/dashboard/dashboard-bottom-section'
import { filterTrendItems } from '@/lib/filterTrendingKeywords'
import { DASHBOARD_TREND_REGIONS } from '@/components/dashboard/dashboard-country-tabs-four'
import { buildDashboardScatterPoints, inferTrendCategory } from '@/lib/dashboard-scatter-points'
import { AnalysisInputBar } from '@/components/dashboard/AnalysisInputBar'
import { RecentAnalyses } from '@/components/dashboard/recent-analyses'

const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'
const ANALYSIS_DEPTH_KEY = 'rin_analysis_depth'

function DatamodSearchInner() {
  const router = useRouter()
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>(() => DATAMOD_LOADING_MESSAGES[0])
  useEffect(() => {
    setLoadingMessage(getRandomDatamodMessage())
  }, [])
  const [recentReports, setRecentReports] = useState<
    { id?: string; keyword: string; created_at: string | null; country_code: string; opportunity_score?: number | null; analysis_status?: string | null }[]
  >([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
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
  /** When true, we're navigating from trend click - keep main UI static, show overlay only */
  const [navigatingFromTrend, setNavigatingFromTrend] = useState(false)
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const abortAnalysis = useResearchStore((s) => s.abortAnalysis)
  const streamingState = useResearchStore((s) => s.streamingState)
  const currentAnalysisKeyword = useResearchStore((s) => s.keyword)
  const isAnalyzingNow = useResearchStore((s) => s.isAnalyzingNow)
  const liveInsightSuggestion = useResearchStore((s) => s.liveInsightSuggestion)
  const liveInsightSuggestionLoading = useResearchStore((s) => s.liveInsightSuggestionLoading)
  /** Use analysis UI only when searching from form; trend click should not change main page */
  const showAnalysisUI = (searching || isAnalyzingNow()) && !navigatingFromTrend

  const searchInputRef = useRef<HTMLInputElement>(null)

  const liveDashboardOpportunityRows = useMemo((): DashboardKeywordRow[] => {
    if (!liveInsightSuggestion) return []
    const li = liveInsightSuggestion
    return [
      {
        keyword: li.focus_market_keyword,
        opportunity_score: li.opportunity_score,
        risk_score: li.risk_score,
        analysis_count: 1,
      },
    ]
  }, [liveInsightSuggestion])

  const handleDepthChange = useCallback((d: DepthMode) => {
    setAnalysisDepth(d)
    try {
      window.localStorage.setItem(ANALYSIS_DEPTH_KEY, d)
    } catch {
      /* ignore */
    }
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis_depth: d }),
    }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!(DASHBOARD_TREND_REGIONS as readonly string[]).includes(trendCountry)) {
      setTrendCountry('KR')
    }
  }, [trendCountry])

  /** 분석 페이지 JS를 미리 받아 트렌드→분석 이동 체감 대기를 줄임 */
  useEffect(() => {
    if (user) {
      try {
        router.prefetch('/results')
      } catch {
        /* ignore */
      }
    }
  }, [user, router])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
      .then((data: { list?: Array<{ id?: string; keyword: string; updated_at?: string | null; country_code?: string; opportunity_score?: number | null; analysis_status?: string | null }> }) => {
        const list = data?.list ?? []
        setRecentReports(list.slice(0, 6).map((r) => ({
          id: typeof r.id === 'string' ? r.id : undefined,
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

  useEffect(() => {
    fetchRecentReports()
  }, [fetchRecentReports])

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
  }, [user, fetchRecentReports, fetchSavedInsights])

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

  const startDashboardAnalysis = async () => {
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
      .then((data: { list?: Array<{ id?: string; keyword: string; updated_at?: string | null; country_code?: string; opportunity_score?: number | null; analysis_status?: string | null }> }) => {
        const list = data?.list ?? []
        setRecentReports(list.slice(0, 6).map((r) => ({
          id: typeof r.id === 'string' ? r.id : undefined,
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

  const refiningPhaseDashboard =
    streamingState.status === 'running' || streamingState.status === 'streaming'
      ? streamingState.progressMeta?.refiningPhase
      : undefined

  const analysisProgressLine = useMemo(() => {
    if (streamingState.status !== 'running' && streamingState.status !== 'streaming') return ''
    return getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep, {
      elapsedMs: stepElapsedMs,
      currentArticleTitle: streamingState.currentArticleTitle,
      progressMeta: streamingState.progressMeta,
    })
  }, [streamingState, stepElapsedMs])

  const dashboardProgressPercent = useMemo(() => {
    if (refiningPhaseDashboard === 1 || refiningPhaseDashboard === 2) return 95
    if (refiningPhaseDashboard === 3) return 100
    return Math.min(100, ((progressStepIndex + 1) / PROGRESS_STEPS.length) * 100)
  }, [refiningPhaseDashboard, progressStepIndex])

  const bannerAnalysisTyping = useAnalysisTypewriter(
    analysisProgressLine,
    showAnalysisUI &&
      (streamingState.status === 'running' || streamingState.status === 'streaming') &&
      Boolean(analysisProgressLine)
  )

  const trendItemsForDash = useMemo(() => {
    const raw = sharedTrends[trendCountry] ?? []
    return filterTrendItems(raw).slice(0, 24)
  }, [sharedTrends, trendCountry])

  const scatterData = useMemo(
    () => buildDashboardScatterPoints(trendItemsForDash, recentReports, liveDashboardOpportunityRows, trendCountry),
    [trendItemsForDash, recentReports, liveDashboardOpportunityRows, trendCountry]
  )

  const topOpportunities = useMemo(() => {
    return trendItemsForDash.slice(0, 5).map((t) => ({
      keyword: t.keyword,
      score: Math.max(28, Math.min(96, 90 - (t.rank || 1) * 5 + (t.keyword.length % 5))),
      sub: `${inferTrendCategory(t.keyword)} · 순위 ${t.rank}`,
    }))
  }, [trendItemsForDash])

  const trendsDataLabel = useMemo(
    () =>
      sharedTrends.updatedAt
        ? new Date(sharedTrends.updatedAt).toLocaleString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '—',
    [sharedTrends.updatedAt]
  )

  const getButtonLabel = () => {
    if (showAnalysisUI) {
      const state = streamingState
      if (state.status === 'running' || state.status === 'streaming') {
        const rp = state.progressMeta?.refiningPhase
        if (rp === 1 || rp === 2 || rp === 3) {
          return `최종 정제 중… (${rp}/3)`
        }
        return `분석 중... (${progressStepIndex + 1}/${PROGRESS_STEPS.length})`
      }
      return '분석 중...'
    }
    return '시장 분석 시작'
  }

  const goToTrendAnalysis = useCallback(
    (item: TrendItem) => {
      if (showAnalysisUI) return
      const originalKeyword = item.keyword
      const translatedKeyword = item.title_ko && item.title_ko !== item.keyword ? item.title_ko : undefined
      setNavigatingFromTrend(true)
      const params = new URLSearchParams({ keyword: originalKeyword, country: trendCountry })
      if (translatedKeyword) params.set('keywordTranslated', translatedKeyword)
      router.push(`/results?${params.toString()}`)
      startStreamingResearch(originalKeyword, { country_code: trendCountry })
    },
    [showAnalysisUI, trendCountry, router, startStreamingResearch]
  )

  if (user === undefined) {
    return <FullPageBrandLoader />
  }
  if (user === null) {
    return <LandingPage />
  }

  return (
    <div className={cn(dashboardPageBg, 'relative min-h-screen')}>
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
              detailMessage={analysisProgressLine || undefined}
              refiningPhase={
                streamingState.status === 'running' || streamingState.status === 'streaming'
                  ? streamingState.progressMeta?.refiningPhase ?? null
                  : null
              }
              showAnimation
            />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex min-h-[calc(100vh-3.5rem)] flex-col overflow-y-auto"
          >
            <DashboardLayout className="gap-5 sm:gap-6">
            {(error != null || (user && canSearch === false)) && (
              <div className="flex flex-col gap-3">
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {user && canSearch === false && (
                  <div className="flex flex-col flex-wrap gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-amber-800 ">Gemini API 키를 등록하면 분석을 사용할 수 있습니다.</p>
                    <Link href="/settings?tab=license" className="shrink-0">
                      <Button variant="secondary" size="sm" className="border-amber-500/50 text-amber-800  hover:bg-amber-500/10">
                        키 등록
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="flex w-full flex-col space-y-6">
            <h1 className="text-lg font-bold text-gray-900">대시보드</h1>

            <AnalysisInputBar
              id="dashboard-analysis-input"
              inputRef={searchInputRef}
              keyword={query}
              onKeywordChange={(v) => {
                setQuery(v)
                setError(null)
              }}
              depth={analysisDepth}
              onDepthChange={handleDepthChange}
              onStart={() => void startDashboardAnalysis()}
              onAbort={handleAbort}
              busy={showAnalysisUI}
              showAbort={searching || isAnalyzingNow()}
            />

            {showAnalysisUI && streamingState.status !== 'idle' && (
              <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-sky-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Loader2 size={18} className="shrink-0 animate-spin text-primary" aria-hidden />
                  <p className="min-w-0 flex-1 text-xs font-medium text-foreground">
                    {(streamingState.status === 'running' || streamingState.status === 'streaming')
                      ? bannerAnalysisTyping
                      : getButtonLabel()}
                  </p>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {(streamingState.status === 'running' || streamingState.status === 'streaming') &&
                    (refiningPhaseDashboard === 1 || refiningPhaseDashboard === 2 || refiningPhaseDashboard === 3)
                      ? `정제 ${refiningPhaseDashboard}/3`
                      : (streamingState.status === 'running' || streamingState.status === 'streaming') &&
                          typeof streamingState.currentStep === 'number'
                        ? `${progressStepIndex + 1}/${PROGRESS_STEPS.length}`
                        : ''}
                  </span>
                </div>
                {(streamingState.status === 'running' || streamingState.status === 'streaming') && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className={cn(
                        'h-full rounded-full bg-primary',
                        refiningPhaseDashboard === 3 ? 'transition-all duration-[550ms] ease-out' : 'transition-all duration-500'
                      )}
                      style={{ width: `${dashboardProgressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            <section className="space-y-5" aria-labelledby="dashboard-market-intel-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="dashboard-market-intel-heading" className="text-sm font-bold text-gray-700">
                  시장 인텔리전스
                </h2>
                <span className="text-xs text-gray-400">데이터 기준 {trendsDataLabel}</span>
              </div>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch">
                <DashboardScatterMatrixCard
                  scatterData={scatterData}
                  scatterLoading={liveInsightSuggestionLoading || trendsLoading}
                  countryCode={trendCountry}
                  className="min-h-[320px]"
                />
                <DashboardRisingTrendsPanel
                  trendCountry={trendCountry}
                  onTrendCountryChange={setTrendCountry}
                  trendItems={trendItemsForDash}
                  trendsLoading={trendsLoading}
                  onTrendAnalyze={goToTrendAnalysis}
                  showAnalysisUI={showAnalysisUI}
                  maxItems={10}
                  className="min-h-[280px] lg:max-h-[min(70vh,560px)]"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <DashboardTrendGrowthCard trendItems={trendItemsForDash} trendsLoading={trendsLoading} />
                <DashboardTopOpportunitiesCard topOpportunities={topOpportunities} />
              </div>
            </section>

            <RecentAnalyses recentReports={recentReports} recentReportsLoading={recentReportsLoading} />
            </div>
            </DashboardLayout>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function DatamodSearch() {
  return (
    <Suspense fallback={<FullPageBrandLoader />}>
      <DatamodSearchInner />
    </Suspense>
  )
}
