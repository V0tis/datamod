'use client'

import React, { Suspense, useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, Loader2, X, History, ChevronRight, Target, Sparkles } from 'lucide-react'
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
const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'

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
      .then((data: { licenseOrigin?: { gemini: string }; canSearch?: boolean } | null) => {
        if (!data) return
        setCanSearch(typeof data.canSearch === 'boolean' ? data.canSearch : null)
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
    startStreamingResearch(k, { country_code: trendCountry })
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
            className="h-[calc(100vh-3.5rem)] flex flex-col px-4 sm:px-6 lg:px-8 py-4 max-w-[1400px] mx-auto overflow-hidden"
          >
            {/* ── Alerts ── */}
            {error && (
              <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive text-sm shrink-0">
                {error}
              </div>
            )}
            {user && canSearch === false && (
              <div className="mb-2 rounded-lg border border-warning/30 bg-warning/5 p-2 flex items-center justify-between gap-2 shrink-0">
                <p className="text-warning text-sm">Gemini API 키를 등록하면 분석을 사용할 수 있습니다.</p>
                <Link href="/settings?tab=license" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-warning text-warning hover:bg-warning/10 h-7 text-xs">키 등록</Button>
                </Link>
              </div>
            )}

            {/* ══════ PRIMARY: Analysis Input (dominant) ══════ */}
            <section id="dashboard-analysis" className="shrink-0 mb-3 rounded-xl border-2 border-primary/20 bg-card p-4 sm:p-5 shadow-sm">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-0.5">어떤 시장을 분석할까요?</h1>
              <p className="text-sm text-muted-foreground mb-3">키워드를 입력하면 AI가 시장 기회, 경쟁 환경, 전략을 분석합니다</p>

              <form onSubmit={handleSearch}>
                <div
                  className={cn(
                    'relative flex items-center rounded-lg border-2 border-border bg-background h-12 sm:h-14 px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all',
                    showAnalysisUI && 'opacity-70'
                  )}
                >
                  <Sparkles className="h-4 w-4 text-primary/40 shrink-0 mr-3" />
                  <Input
                    type="search"
                    aria-label="분석할 시장 키워드"
                    placeholder="예: AI 작성 도구, 리모트워크 SaaS, 에듀테크 플랫폼..."
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setError(null) }}
                    disabled={showAnalysisUI}
                    className="border-0 bg-transparent pl-0 pr-24 h-full py-0 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
                  />
                  {query.length > 0 && !showAnalysisUI && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      className="absolute right-[100px] top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="검색어 지우기"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    {(searching || isAnalyzingNow()) ? (
                      <Button type="button" variant="destructive" onClick={handleAbort} size="sm" className="h-8 sm:h-9 px-3 text-xs font-medium">
                        <X className="h-3.5 w-3.5 mr-1" />중단
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!query.trim()} size="sm" className="h-8 sm:h-9 px-4 sm:px-5 text-xs sm:text-sm font-semibold">
                        분석 시작
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {['AI 작성 도구', '리모트워크 SaaS', '푸드테크', '에듀테크 플랫폼', '건강 모니터링', '전동킥보드 공유'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => { setQuery(k); setError(null) }}
                      disabled={showAnalysisUI}
                      className="rounded-md border border-border/50 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground transition-colors disabled:opacity-40"
                    >
                      {k}
                    </button>
                  ))}
                </div>
              </form>

              {showAnalysisUI && streamingState.status !== 'idle' && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
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
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, ((progressStepIndex + 1) / PROGRESS_STEPS.length) * 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* ══════ SECONDARY: Data panels (compact 2-col) ══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 min-h-0 max-h-[45vh]">

              {/* Left: Trends */}
              <div className="rounded-lg border border-border bg-card flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                  <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    급상승 트렌드
                  </h2>
                  <div className="flex items-center gap-1.5">
                    <CountryChips
                      value={trendCountry}
                      onChange={setTrendCountry}
                      compact
                    />
                    <Link href="/trends" className="text-[11px] text-muted-foreground hover:text-primary transition-colors shrink-0 ml-1">
                      전체
                    </Link>
                  </div>
                </div>
                <div className="flex-1 overflow-auto min-h-0">
                  {trendsLoading ? (
                    <div className="divide-y divide-border">
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                          <span className="h-3.5 w-4 bg-muted rounded animate-pulse" />
                          <span className="h-3.5 w-32 bg-muted rounded animate-pulse" />
                          <span className="ml-auto h-3 w-12 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : trendItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                      <TrendingUp className="h-6 w-6 text-muted-foreground/20 mb-1.5" />
                      <p className="text-xs text-muted-foreground">트렌드 데이터가 없습니다</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {trendItems.map((item, i) => {
                        const hasTranslation = item.title_ko != null && item.title_ko !== item.keyword
                        const showBoth = trendCountry !== 'KR' && hasTranslation
                        const displayName = showBoth
                          ? `${item.keyword} · ${item.title_ko}`
                          : hasTranslation
                            ? item.title_ko!
                            : item.keyword
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
                            className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors w-full text-left"
                          >
                            <span className="text-[11px] text-muted-foreground/40 tabular-nums w-4 shrink-0 text-right">{i + 1}</span>
                            <span className="text-[13px] text-foreground group-hover:text-primary transition-colors truncate flex-1 min-w-0">
                              {displayName}
                            </span>
                            {subLabel && (
                              <span className="text-[10px] text-muted-foreground/50 tabular-nums shrink-0">{subLabel}</span>
                            )}
                            {item.started_at && (
                              <span className="text-[10px] text-muted-foreground/40 shrink-0">
                                <TimeAgo isoString={item.started_at} />
                              </span>
                            )}
                            <ChevronRight className="h-3 w-3 text-muted-foreground/25 group-hover:text-muted-foreground transition-colors shrink-0" />
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="px-3 py-1 border-t border-border shrink-0">
                  <p className="text-[10px] text-muted-foreground/40">RSS·트렌드 기준 · 1시간 캐시</p>
                </div>
              </div>

              {/* Right: Recent Analysis */}
              <div className="rounded-lg border border-border bg-card flex flex-col min-h-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
                  <h2 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
                    <History className="h-3 w-3 text-muted-foreground" />
                    최근 분석
                  </h2>
                  <Link href="/history" className="text-[11px] text-muted-foreground hover:text-primary transition-colors">
                    전체 보기
                  </Link>
                </div>
                <div className="flex-1 overflow-auto min-h-0">
                  {recentReportsLoading ? (
                    <div className="divide-y divide-border">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                          <span className="h-3.5 w-28 bg-muted rounded animate-pulse" />
                          <span className="ml-auto h-3 w-8 bg-muted rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  ) : recentReports.length > 0 ? (
                    <div className="divide-y divide-border">
                      {recentReports.map((r, i) => (
                        <Link
                          key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}
                          href={`/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`}
                          className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-[13px] text-foreground group-hover:text-primary transition-colors truncate flex-1 min-w-0">
                            {r.keyword}
                          </span>
                          {r.opportunity_score != null && r.analysis_status !== 'analyzing' && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
                              <Target className="h-2.5 w-2.5 text-primary/60" />
                              {r.opportunity_score}
                            </span>
                          )}
                          {r.analysis_status === 'analyzing' && (() => {
                            const isCurrent = (r.keyword?.trim() ?? '') === (currentAnalysisKeyword?.trim() ?? '')
                            const hasStep = isCurrent && (streamingState.status === 'running' || streamingState.status === 'streaming')
                            const stepNum = hasStep ? (streamingState.currentStep ?? 0) + 1 : 1
                            return (
                              <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-600 shrink-0">
                                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                {stepNum}/{PROGRESS_STEPS.length}
                              </span>
                            )
                          })()}
                          <span className="text-[10px] text-muted-foreground/60 shrink-0 tabular-nums">
                            <TimeAgo isoString={r.created_at} />
                          </span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-6 text-center">
                      <History className="h-6 w-6 text-muted-foreground/20 mb-1.5" />
                      <p className="text-xs text-muted-foreground">분석 기록이 없습니다</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-0.5">상단에서 첫 분석을 시작하세요</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
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
