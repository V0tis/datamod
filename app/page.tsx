'use client'

import React, { Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, X, Sparkles, Search, Play, CheckCircle2 } from 'lucide-react'
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
import { TimeAgo } from '@/components/time-ago'
import { COUNTRY_CHIP_CODES, type CountryChipCode } from '@/components/country-chips'
import type { TrendItem } from '@/lib/trends-types'
import { getAnalysisActivityMessage, getProgressStepIndex, PROGRESS_STEPS } from '@/lib/analysis-activity-messages'
import { LandingPage } from '@/components/landing/landing-page'
import { FullPageBrandLoader } from '@/components/full-page-brand-loader'
import type { SavedInsight } from '@/lib/insights-types'
import type { DashboardKeywordRow } from '@/lib/types/dashboard-keyword-row'
import { DEPTH_LABELS, depthToApiMode, getDepthEstimates, formatEstimatedTime, type DepthMode } from '@/lib/analysis-estimates'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardCardShell } from '@/components/dashboard/dashboard-card-shell'
import { dashboardPageBg } from '@/components/dashboard/dashboard-tokens'
import { DashboardHeroPro } from '@/components/dashboard/dashboard-hero-pro'
import { DashboardMarketIntelligence } from '@/components/dashboard/dashboard-market-intelligence'
import { DashboardBottomSection, type AiSignalCard } from '@/components/dashboard/dashboard-bottom-section'
import { DASHBOARD_TREND_REGIONS } from '@/components/dashboard/dashboard-country-tabs-four'
import { buildDashboardScatterPoints, inferTrendCategory } from '@/lib/dashboard-scatter-points'
import { useDashboardSignalCounts } from '@/hooks/use-dashboard-data'

const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'
const ANALYSIS_DEPTH_KEY = 'rin_analysis_depth'

function recentInsightLabel(score: number | null | undefined, analyzing: boolean): string {
  if (analyzing) return '분석 중'
  if (score == null) return '요약 대기'
  if (score >= 70) return '진입 추천'
  if (score >= 45) return '성장 중'
  return '관망'
}

const itemCardClass =
  'rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950'

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
  const [recentReports, setRecentReports] = useState<{ keyword: string; created_at: string | null; country_code: string; opportunity_score?: number | null; analysis_status?: string | null }[]>([])
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
  const depthEstimates = getDepthEstimates(analysisDepth)
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

  const liveDashboardRiskRows = useMemo((): DashboardKeywordRow[] => {
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

  const scrollToSearchAndFocus = useCallback(() => {
    searchInputRef.current?.focus()
    document.getElementById('quick-analysis-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  const [searchShortcutLabel, setSearchShortcutLabel] = useState('⌘K')
  useEffect(() => {
    if (typeof navigator !== 'undefined' && !/Mac|iPhone|iPad/.test(navigator.platform)) {
      setSearchShortcutLabel('Ctrl+K')
    }
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

  const displayName = useMemo(() => {
    if (!user) return 'PM'
    const meta = user.user_metadata as { full_name?: string } | undefined
    return meta?.full_name?.trim() || user.email?.split('@')[0] || 'PM'
  }, [user])

  const { strongOppCount, strongRiskCount } = useDashboardSignalCounts(
    liveDashboardOpportunityRows,
    liveDashboardRiskRows
  )

  const trendItemsForDash = useMemo(() => (sharedTrends[trendCountry] ?? []).slice(0, 14), [sharedTrends, trendCountry])

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

  const aiSignals = useMemo((): AiSignalCard[] => {
    const out: AiSignalCard[] = []
    if (liveInsightSuggestion) {
      out.push({
        keyword: liveInsightSuggestion.focus_market_keyword,
        score: liveInsightSuggestion.opportunity_score,
        insight: liveInsightSuggestion.rationale_one_liner,
        href: `/results?keyword=${encodeURIComponent(liveInsightSuggestion.focus_market_keyword)}&country=${encodeURIComponent(trendCountry)}`,
      })
    }
    const seen = new Set(out.map((x) => x.keyword))
    for (const t of trendItemsForDash) {
      if (out.length >= 3) break
      if (seen.has(t.keyword)) continue
      seen.add(t.keyword)
      out.push({
        keyword: t.keyword,
        score: Math.max(32, Math.min(94, 86 - (t.rank || 1) * 4)),
        insight: `${inferTrendCategory(t.keyword)} 키워드가 검색 급상승 목록에 포함되어 있습니다.`,
        href: `/results?keyword=${encodeURIComponent(t.keyword)}&country=${encodeURIComponent(trendCountry)}`,
      })
    }
    return out.slice(0, 3)
  }, [liveInsightSuggestion, trendItemsForDash, trendCountry])

  const marketSignalCount = useMemo(() => {
    const n = trendItemsForDash.length
    if (n > 0) return n
    return Math.max(strongOppCount + strongRiskCount, liveInsightSuggestion ? 1 : 0)
  }, [trendItemsForDash.length, strongOppCount, strongRiskCount, liveInsightSuggestion])

  const trendSignalCount = trendItemsForDash.length

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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => scrollToSearchAndFocus()}
                className="inline-flex items-center gap-2 rounded-full border border-[#E5E9F2] bg-white px-3 py-1.5 text-[13px] font-medium text-[#374151] shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <Search className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                검색
                <kbd className="rounded border border-[#E5E9F2] bg-slate-50 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-[#6B7280] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {searchShortcutLabel}
                </kbd>
              </button>
            </div>

            <DashboardHeroPro
              displayName={displayName}
              marketSignalCount={marketSignalCount}
              highOpportunityCount={strongOppCount}
              highRiskCount={strongRiskCount}
              trendSignalCount={trendSignalCount}
              onNewAnalysis={scrollToSearchAndFocus}
            />

            <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:gap-5">
              <div id="quick-analysis-card" className="w-full shrink-0 xl:w-[240px]">
                <DashboardCardShell
                  id="dashboard-analysis"
                  compact
                  className="h-full min-h-0 rounded-[12px] border border-[#E5E9F2] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)] dark:border-zinc-700 dark:bg-zinc-950"
                  icon={<Search size={18} className="text-sky-600 dark:text-sky-400" aria-hidden />}
                  title="빠른 분석"
                  description="키워드와 깊이를 선택한 뒤 분석을 시작하세요."
                  footer={
                    <Link href="/history" className="text-[12px] font-medium text-sky-600 hover:underline dark:text-sky-400">
                      분석 기록 열기 →
                    </Link>
                  }
                >
                  <form onSubmit={handleSearch} className="space-y-3">
                    <div
                      className={cn(
                        'relative flex min-h-[2.75rem] w-full items-center rounded-xl border border-[#E5E9F2] bg-white px-3 py-1.5 shadow-sm transition-all focus-within:border-[#2AC1BC] focus-within:ring-2 focus-within:ring-[#2AC1BC]/20 dark:border-zinc-700 dark:bg-zinc-950',
                        showAnalysisUI && 'opacity-70'
                      )}
                    >
                      <Sparkles size={18} className="mr-1.5 shrink-0 text-primary/60" aria-hidden />
                      <Input
                        ref={searchInputRef}
                        id="dashboard-keyword-input"
                        type="search"
                        aria-label="분석할 시장 키워드"
                        placeholder="키워드 입력"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setError(null) }}
                        disabled={showAnalysisUI}
                        className="h-full min-h-[2.25rem] flex-1 min-w-0 border-0 bg-transparent py-2 pl-0 pr-[5.5rem] text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 sm:right-3">
                        {(searching || isAnalyzingNow()) ? (
                          <Button type="button" variant="destructive" onClick={handleAbort} size="sm" className="h-10 rounded-xl px-4 text-sm font-semibold">
                            <X className="mr-1.5 h-3.5 w-3.5" />중단
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={!query.trim()}
                            size="sm"
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#2AC1BC] px-6 text-sm font-bold text-white hover:bg-[#26b0ab]"
                          >
                            <Play size={20} className="shrink-0" fill="currentColor" aria-hidden />
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
                      <p className="text-[12px] font-semibold text-[#374151] dark:text-zinc-400">빠른 분석 키워드</p>
                      <div className="flex flex-wrap gap-1.5">
                        {['AI 작성 도구', '리모트워크 SaaS', '푸드테크', '에듀테크', 'B2B 결제', '클린뷰티 D2C'].map((k) => (
                          <button
                            key={k}
                            type="button"
                            onClick={() => { setQuery(k); setError(null) }}
                            disabled={showAnalysisUI}
                            className="rounded-full border border-[#E5E9F2] bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-[#374151] transition hover:bg-white disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                          >
                            {k}
                          </button>
                        ))}
                      </div>
                    </div>
                  </form>

                  {showAnalysisUI && streamingState.status !== 'idle' && (
                    <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-sky-50 px-3 py-2.5 dark:border-zinc-700 dark:bg-sky-950/30">
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

                  <div className="mt-4 border-t border-[#F3F4F6] pt-4 dark:border-zinc-800">
                    <p className="text-[12px] font-semibold text-[#374151] dark:text-zinc-400">최근 분석</p>
                    <div className="mt-2 space-y-2">
                      {recentReportsLoading ? (
                        [1, 2, 3].map((i) => (
                          <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-zinc-900" />
                        ))
                      ) : recentReports.length === 0 ? (
                        <p className="text-[12px] text-[#6B7280]">아직 기록이 없습니다</p>
                      ) : (
                        recentReports.slice(0, 3).map((r, i) => {
                          const analyzing = r.analysis_status === 'analyzing'
                          const href = `/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`
                          return (
                            <Link
                              key={r.keyword + String(i)}
                              href={href}
                              className={cn(itemCardClass, 'block rounded-[10px] p-3 transition-shadow hover:shadow-md')}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0 truncate text-[13px] font-semibold text-neutral-900 dark:text-zinc-100">{r.keyword}</span>
                                {analyzing ? (
                                  <Loader2 size={16} className="shrink-0 animate-spin text-amber-600" aria-hidden />
                                ) : r.opportunity_score != null ? (
                                  <span className="shrink-0 text-[12px] font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{r.opportunity_score}</span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-[#6B7280]">{recentInsightLabel(r.opportunity_score, analyzing)}</p>
                              <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#9CA3AF]">
                                {r.created_at ? <TimeAgo isoString={r.created_at} /> : <span>—</span>}
                                <span className="font-medium text-sky-600 dark:text-sky-400">열기</span>
                              </div>
                            </Link>
                          )
                        })
                      )}
                    </div>
                  </div>
                </DashboardCardShell>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[#374151] dark:text-zinc-300">시장 인텔리전스</h2>
                  {sharedTrends.updatedAt ? (
                    <p className="text-[11px] text-[#9CA3AF]">데이터 기준 {new Date(sharedTrends.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  ) : null}
                </div>
                <DashboardMarketIntelligence
                  scatterData={scatterData}
                  scatterLoading={liveInsightSuggestionLoading || trendsLoading}
                  trendItems={trendItemsForDash}
                  trendsLoading={trendsLoading}
                  topOpportunities={topOpportunities}
                  countryCode={trendCountry}
                />
              </div>
            </div>

            <DashboardBottomSection
              trendCountry={trendCountry}
              onTrendCountryChange={setTrendCountry}
              trendItems={trendItemsForDash}
              trendsLoading={trendsLoading}
              onTrendAnalyze={goToTrendAnalysis}
              showAnalysisUI={showAnalysisUI}
              aiSignals={aiSignals}
            />
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
