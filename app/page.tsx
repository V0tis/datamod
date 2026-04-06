'use client'

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, Loader2, X, History, Sparkles, BarChart3, Clock, Search } from 'lucide-react'
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
import { type DecisionSummaryData } from '@/components/dashboard/decision-summary'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardCardShell } from '@/components/dashboard/dashboard-card-shell'
import { dashboardPageBg, dashboardCardClass } from '@/components/dashboard/dashboard-tokens'
import { DashboardChartsBlock } from '@/components/dashboard/dashboard-charts'
import { MiniSparkline } from '@/components/dashboard/mini-sparkline'
import { DashboardHeroBaemin } from '@/components/dashboard/dashboard-hero-baemin'
import { DashboardKpiStrip } from '@/components/dashboard/dashboard-kpi-strip'
import { DashboardMonitorTop3 } from '@/components/dashboard/dashboard-monitor-top3'
import { DashboardInsightStrip } from '@/components/dashboard/dashboard-insight-strip'
import { useDashboardSignalCounts } from '@/hooks/use-dashboard-data'

const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'
const ANALYSIS_DEPTH_KEY = 'rin_analysis_depth'

function opportunityInsightTag(score: number): string {
  if (score >= 75) return '진입 추천'
  if (score >= 50) return '성장 중'
  return '관망'
}

function riskInsightTag(score: number): string {
  if (score >= 70) return '경쟁 높음'
  if (score >= 45) return '주의'
  return '경쟁 낮음'
}

function recentInsightLabel(score: number | null | undefined, analyzing: boolean): string {
  if (analyzing) return '분석 중'
  if (score == null) return '요약 대기'
  if (score >= 70) return '진입 추천'
  if (score >= 45) return '성장 중'
  return '관망'
}

const itemCardClass =
  'rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950'

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
        reasons: [`기회 ${top.opportunity_score}점 · 상위 코호트`, `분석 ${top.analysis_count}건 반영`],
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
        reasons: [`${trendCountry} 트렌드 상위`, '관심 급증 신호'],
        strategyHref: `/results?keyword=${encodeURIComponent(t.keyword)}&country=${encodeURIComponent(trendCountry)}`,
        source: 'trend',
      }
    }
    return {
      recommendedKeyword: null,
      confidence: null,
      confidenceLabel: '데이터 준비 중',
      reasons: ['키워드 입력 → 분석 시작', '완료 후 자동 추천'],
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

  const displayName = useMemo(() => {
    if (!user) return 'PM'
    const meta = user.user_metadata as { full_name?: string } | undefined
    return meta?.full_name?.trim() || user.email?.split('@')[0] || 'PM'
  }, [user])

  const { strongOppCount, strongRiskCount } = useDashboardSignalCounts(
    dashboardRecs.highOpportunity,
    dashboardRecs.highRisk
  )

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
    <div className={cn(dashboardPageBg, 'relative min-h-screen')}>
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
            <DashboardLayout className="gap-6">
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

            <DashboardHeroBaemin
              displayName={displayName}
              strongOppCount={strongOppCount}
              strongRiskCount={strongRiskCount}
            />

            <DashboardKpiStrip
              opportunities={dashboardRecs.highOpportunity}
              risks={dashboardRecs.highRisk}
              trendItems={trendItems}
              recentAnalysisCount={recentReports.length}
              loading={dashboardRecsLoading || trendsLoading}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
              <div className="space-y-4">
                <DashboardMonitorTop3
                  opportunities={dashboardRecs.highOpportunity}
                  risks={dashboardRecs.highRisk}
                  trendCountry={trendCountry}
                  loading={dashboardRecsLoading}
                  opportunityInsightTag={opportunityInsightTag}
                  riskInsightTag={riskInsightTag}
                />
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/history">기록에서 키워드 고르기</Link>
                </Button>
              </div>

              <div className="min-w-0 space-y-4">
                <div className={cn(dashboardCardClass, 'overflow-hidden p-4 sm:p-5')}>
                  <div className="mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                    <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-50">트렌드 · 기회 · 리스크</h3>
                  </div>
                  <DashboardChartsBlock
                    variant="stack"
                    opportunities={dashboardRecs.highOpportunity}
                    risks={dashboardRecs.highRisk}
                    trendItems={trendItems}
                    loading={dashboardRecsLoading || trendsLoading}
                  />
                </div>
                <DashboardInsightStrip
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
              </div>

              <div className="flex min-w-0 flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CountryChips value={trendCountry} onChange={setTrendCountry} compact />
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/trends">트렌드 더보기</Link>
                  </Button>
                </div>

            <DashboardCardShell
              id="dashboard-analysis"
              icon={<Search className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />}
              title="시장 키워드"
              description="검색 후 즉시 분석 · 깊이 선택"
              footer={
                !showAnalysisUI ? (
                  <p className="text-xs text-slate-600 dark:text-zinc-400">
                    키워드 확정 → <span className="font-semibold text-neutral-800 dark:text-zinc-200">분석</span> → 전략 확인
                  </p>
                ) : undefined
              }
            >
                <form onSubmit={handleSearch} className="space-y-4">
                  <div
                    className={cn(
                      'relative flex h-12 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 shadow-sm transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-950 sm:h-14',
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
                            ? 'border-sky-500 bg-sky-50 text-sky-800 dark:border-sky-600 dark:bg-sky-950/50 dark:text-sky-200'
                            : 'border-[#E5E7EB] bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
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
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">빠른 분석 키워드</p>
                    <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-0.5">
                      {['AI 작성 도구', '리모트워크 SaaS', '푸드테크', '에듀테크', 'B2B 결제', '클린뷰티 D2C'].map((k) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => { setQuery(k); setError(null); searchInputRef.current?.focus() }}
                          disabled={showAnalysisUI}
                          className="shrink-0 rounded-xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/90 to-sky-50/80 px-4 py-2.5 text-left shadow-sm transition hover:border-cyan-300 disabled:opacity-40 dark:border-cyan-900/50 dark:from-cyan-950/40 dark:to-sky-950/30"
                        >
                          <span className="text-xs font-bold text-cyan-900 dark:text-cyan-100">{k}</span>
                          <span className="mt-0.5 block text-[10px] font-medium text-cyan-700/80 dark:text-cyan-300/80">탭하여 분석</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </form>

                {showAnalysisUI && streamingState.status !== 'idle' && (
                  <div className="rounded-xl border border-[#E5E7EB] bg-sky-50 px-4 py-3 dark:border-zinc-700 dark:bg-sky-950/30">
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

            <section aria-labelledby="dash-trends-heading">
              <DashboardCardShell
                titleId="dash-trends-heading"
                icon={<TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" aria-hidden />}
                title="급상승 트렌드"
                description="실시간 급상승 키워드"
                headerRight={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/trends">전체</Link>
                  </Button>
                }
              >
                <div className="max-h-[min(70vh,520px)] space-y-3 overflow-y-auto pr-1">
                  {trendsLoading ? (
                    [1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="h-24 animate-pulse rounded-xl border border-[#E5E7EB] bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900" />
                    ))
                  ) : trendItems.length === 0 ? (
                    <div className={cn(itemCardClass, 'py-8 text-center')}>
                      <p className="text-sm text-slate-600 dark:text-zinc-400">표시할 트렌드 없음</p>
                      <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                        직접 분석
                      </Button>
                    </div>
                  ) : (
                    trendItems.slice(0, 8).map((item, i) => {
                      const hasTranslation = item.title_ko != null && item.title_ko !== item.keyword
                      const showBoth = trendCountry !== 'KR' && hasTranslation
                      const trendRowTitle = showBoth ? `${item.keyword} · ${item.title_ko}` : hasTranslation ? item.title_ko! : item.keyword
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
                        <div key={`${trendCountry}-${item.keyword}-${i}`} className={itemCardClass}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-neutral-900 dark:text-zinc-100">{trendRowTitle}</p>
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                                성장 중 · 급상승
                                {subLabel != null && subLabel !== '' ? ` · ${subLabel}` : ''}
                                {item.started_at ? (
                                  <>
                                    {' · '}
                                    <TimeAgo isoString={item.started_at} />
                                  </>
                                ) : null}
                              </p>
                            </div>
                            <MiniSparkline seed={i * 31 + item.keyword.length} />
                          </div>
                          <Button type="button" size="sm" className="mt-3 w-full font-semibold" onClick={runAnalysis} disabled={showAnalysisUI}>
                            분석
                          </Button>
                        </div>
                      )
                    })
                  )}
                </div>
              </DashboardCardShell>
            </section>

            <section aria-labelledby="dash-recent-heading">
              <DashboardCardShell
                titleId="dash-recent-heading"
                icon={<History className="h-5 w-5 text-slate-600 dark:text-zinc-400" aria-hidden />}
                title="최근 분석"
                description="타임라인 · 결과로 이동"
                headerRight={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/history">기록</Link>
                  </Button>
                }
                footer={
                  recentReports.length > 0 ? (
                    <Button type="button" size="sm" className="w-full font-semibold" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                      새 분석
                    </Button>
                  ) : undefined
                }
              >
                <div className="max-h-[min(55vh,440px)] space-y-3 overflow-y-auto pr-1">
                  {recentReportsLoading ? (
                    [1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-28 animate-pulse rounded-xl border border-[#E5E7EB] bg-slate-100 dark:border-zinc-800 dark:bg-zinc-900" />
                    ))
                  ) : recentReports.length > 0 ? (
                    recentReports.slice(0, 8).map((r, i) => {
                      const analyzing = r.analysis_status === 'analyzing'
                      const href = `/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`
                      const isCurrent = (r.keyword?.trim() ?? '') === (currentAnalysisKeyword?.trim() ?? '')
                      const hasStep = analyzing && isCurrent && (streamingState.status === 'running' || streamingState.status === 'streaming')
                      const stepNum = hasStep ? (streamingState.currentStep ?? 0) + 1 : 1
                      return (
                        <Link
                          key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}
                          href={href}
                          className={cn(itemCardClass, 'block transition-shadow hover:shadow-md')}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-zinc-500" aria-hidden />
                              <span className="truncate text-sm font-semibold text-neutral-900 dark:text-zinc-100">{r.keyword}</span>
                            </div>
                            {r.opportunity_score != null && !analyzing && (
                              <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold tabular-nums text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                                {r.opportunity_score}
                              </span>
                            )}
                            {analyzing && (
                              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {stepNum}/{PROGRESS_STEPS.length}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-slate-600 dark:text-zinc-400">{recentInsightLabel(r.opportunity_score, analyzing)}</p>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500">
                            <TimeAgo isoString={r.created_at} />
                            <span className="font-semibold text-sky-600 dark:text-sky-400">열기 →</span>
                          </div>
                        </Link>
                      )
                    })
                  ) : (
                    <div className={cn(itemCardClass, 'py-8 text-center')}>
                      <p className="text-sm text-slate-600 dark:text-zinc-400">기록 없음</p>
                      <Button type="button" size="sm" className="mt-3" onClick={scrollToSearchAndFocus} disabled={showAnalysisUI}>
                        분석 시작
                      </Button>
                    </div>
                  )}
                </div>
              </DashboardCardShell>
            </section>
            </div>
            </div>
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
