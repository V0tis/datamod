'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, History, ChevronRight, Loader2, X, Target } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'
import { RinAnimation, getRandomRinMessage, RIN_LOADING_MESSAGES } from '@/components/common/RinAnimation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendsResponse } from '@/lib/trends-types'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import { CountryChips, COUNTRY_CHIP_CODES, COUNTRY_LABELS, type CountryChipCode } from '@/components/country-chips'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
const MAIN_TRENDS_TOP_N = 10
const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'

function RinAISearchInner() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState<string>(() => RIN_LOADING_MESSAGES[0])
  useEffect(() => {
    setLoadingMessage(getRandomRinMessage())
  }, [])
  const [recentReports, setRecentReports] = useState<{ keyword: string; created_at: string | null; country_code: string; opportunity_score?: number | null; analysis_status?: string | null }[]>([])
  const [recentReportsLoading, setRecentReportsLoading] = useState(false)
  const [licenseOrigin, setLicenseOrigin] = useState<'USER' | 'SYSTEM' | null>(null)
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
  const [trendStatus, setTrendStatus] = useState<TrendsResponse['trendStatus']>(undefined)
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
  const engineActive = Object.values(jobs).some((job) => job.status === 'queued' || job.status === 'running') || isAnalyzingNow()
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
      setLicenseOrigin(null)
      setCanSearch(null)
      return
    }
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { licenseOrigin?: { gemini: string }; canSearch?: boolean } | null) => {
        if (!data) return
        if (data.licenseOrigin?.gemini) {
          setLicenseOrigin(data.licenseOrigin.gemini === 'USER' ? 'USER' : 'SYSTEM')
        }
        setCanSearch(typeof data.canSearch === 'boolean' ? data.canSearch : null)
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '설정 정보를 불러오지 못했습니다.' })
        setLicenseOrigin(null)
        setCanSearch(null)
      })
  }, [user])

  useEffect(() => {
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

  const fetchTrends = (forceRefresh = false) => {
    const url = forceRefresh ? '/api/trends?refresh=1' : '/api/trends'
    setTrendsLoading(true)
    fetch(url)
      .then((res) => parseJsonResponse<TrendsResponse & { refreshed?: boolean; refreshFailed?: boolean }>(res))
      .then((data) => {
        setSharedTrends({
          KR: normalizeTrendItems(data.KR),
          US: normalizeTrendItems(data.US),
          JP: normalizeTrendItems(data.JP),
          TW: normalizeTrendItems(data.TW),
          HK: normalizeTrendItems(data.HK),
          GB: normalizeTrendItems(data.GB),
          DE: normalizeTrendItems(data.DE),
          updatedAt: data.updatedAt ?? null,
        })
        setTrendStatus(data.trendStatus)
        if (data.refreshed) toast.success('데이터가 최신 상태로 업데이트되었습니다')
        if (data.refreshFailed) toast.warning('일시적 오류로 갱신에 실패했습니다. 기존 데이터를 표시합니다.')
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 데이터를 불러오지 못했습니다.' }))
      .finally(() => setTrendsLoading(false))
  }

  useEffect(() => {
    fetchTrends(false)
  }, [])

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

  const getButtonLabel = () => {
    if (showAnalysisUI) {
      const state = streamingState
      if (state.status === 'running' || state.status === 'streaming') {
        return `분석 중... (${state.currentStep + 1}/5)`
      }
      return '분석 중...'
    }
    return '시장 분석 시작'
  }

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
            className="flex flex-col items-center justify-center min-h-[60vh] p-6"
          >
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <RinAnimation variant="loading" size={200} className="mx-auto block" />
              <p className="text-center font-medium text-foreground mt-4">
                {streamingState.status === 'running' || streamingState.status === 'streaming'
                  ? getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep)
                  : loadingMessage}
              </p>
              <p className="text-center text-muted-foreground text-sm mt-1">
                {(streamingState.status === 'running' || streamingState.status === 'streaming') &&
                typeof streamingState.currentStep === 'number'
                  ? `단계 ${streamingState.currentStep + 1}/5`
                  : '잠시만 기다려 주세요.'}
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 md:p-5"
          >
            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
                {error}
              </div>
            )}

            {user && canSearch === false && (
              <div className="mb-4 rounded-lg border border-warning/30 bg-warning/5 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <p className="text-warning text-sm">설정에서 Gemini API 키를 등록한 뒤 분석을 사용할 수 있습니다.</p>
                <Link href="/settings?tab=license" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-warning text-warning hover:bg-warning/10 h-8">
                    키 등록하러 가기
                  </Button>
                </Link>
              </div>
            )}

            {/* 1. Start New Analysis — primary focus, first visible */}
            <section className="mb-8 max-w-3xl mx-auto">
              <div className="rounded-xl border border-border bg-card p-6 md:p-8 shadow-sm">
                <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-6">어떤 시장을 분석하고 싶나요?</h2>
                <form onSubmit={handleSearch} className="space-y-5">
                  <div
                    className={cn(
                      'relative flex items-center rounded-lg border-2 border-border bg-background h-14 px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all',
                      showAnalysisUI && 'opacity-80'
                    )}
                  >
                    <Input
                      type="search"
                      aria-label="분석할 시장 키워드"
                      placeholder="예: AI 회의 보조"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setError(null)
                      }}
                      disabled={showAnalysisUI}
                      className="border-0 bg-transparent pl-0 pr-10 h-full py-0 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
                    />
                    {query.length > 0 && !showAnalysisUI && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="검색어 지우기"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <div className="flex justify-end pt-1">
                    {(searching || isAnalyzingNow()) ? (
                      <Button type="button" variant="destructive" onClick={handleAbort} className="h-10 px-6 text-sm">
                        <X className="h-4 w-4 mr-2" />
                        분석 중단
                      </Button>
                    ) : (
                      <Button type="submit" disabled={!query.trim()} size="lg" className="h-11 px-8 text-base font-semibold">
                        {getButtonLabel()}
                      </Button>
                    )}
                  </div>
                </form>
                {showAnalysisUI && streamingState.status !== 'idle' && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mt-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {(streamingState.status === 'running' || streamingState.status === 'streaming')
                            ? getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep)
                            : getButtonLabel()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(streamingState.status === 'running' || streamingState.status === 'streaming') &&
                          typeof streamingState.currentStep === 'number'
                            ? `단계 ${streamingState.currentStep + 1}/5`
                            : '시장 데이터 수집 → 트렌드 분석 → 리스크·전략·액션 도출'}
                        </p>
                      </div>
                    </div>
                    {(streamingState.status === 'running' || streamingState.status === 'streaming') && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>진행률</span>
                          <span>{Math.round(((streamingState.currentStep + 1) / 5) * 100)}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${((streamingState.currentStep + 1) / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* 2. 실시간 검색 트렌드 */}
            <div className="mx-auto max-w-5xl mb-5">
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3 gap-2 flex-wrap">
                  <div>
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary shrink-0" />
                      실시간 검색 트렌드
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">구글 실시간 급상승 검색어 (RSS 기반)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <CountryChips
                      value={trendCountry}
                      onChange={setTrendCountry}
                      updatedAt={sharedTrends.updatedAt}
                    />
                    <Link href="/trends" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5 shrink-0">
                      전체 보기 <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
                {trendsLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 py-4">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="rounded-lg border border-border bg-muted/20 h-20 animate-pulse" />
                    ))}
                  </div>
                ) : (sharedTrends[trendCountry] ?? []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center rounded-lg border border-dashed border-border">
                    <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">트렌드 데이터가 없습니다</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {(sharedTrends[trendCountry] ?? []).slice(0, 6).map((item, i) => {
                      const hasTranslation = item.title_ko != null && item.title_ko !== item.keyword
                      const showBoth = trendCountry !== 'KR' && hasTranslation
                      const displayName = showBoth
                        ? `${item.keyword} · ${item.title_ko}`
                        : hasTranslation
                          ? item.title_ko!
                          : item.keyword
                      const growthPct = Math.round(250 - (item.rank ?? i + 1) * 18)
                      return (
                        <button
                          key={`${trendCountry}-${i}`}
                          type="button"
                          onClick={() => {
                            const keyword = item.title_ko ?? item.keyword
                            setNavigatingFromTrend(true)
                            router.push(`/results?keyword=${encodeURIComponent(keyword)}&country=${encodeURIComponent(trendCountry)}`)
                            startStreamingResearch(keyword, { country_code: trendCountry })
                          }}
                          className="group text-left rounded-lg border border-border bg-background p-3 hover:border-primary/40 hover:bg-primary/5 transition-all"
                        >
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {displayName}
                          </p>
                          <p className="text-xs text-emerald-600 mt-0.5 font-medium tabular-nums">
                            ↑ {Math.max(80, growthPct)}%
                          </p>
                        </button>
                      )
                    })}
                  </div>
                )}
                <p className="text-muted-foreground text-xs mt-2">RSS·트렌드 기준 (1시간 캐시)</p>
              </section>
            </div>

            {/* 3. Recent Analyses */}
            <div className="mx-auto max-w-5xl">
              <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <History className="h-4 w-4 text-primary shrink-0" />
                    최근 분석 기록
                  </h2>
                  <Link href="/history" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5 shrink-0">
                    전체 보기 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {user ? (
                  recentReportsLoading ? (
                    <div className="space-y-2" aria-busy="true" aria-label="최근 분석 불러오는 중">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="h-4 w-32 bg-muted rounded animate-pulse" />
                            <span className="h-3 w-16 bg-muted rounded animate-pulse shrink-0" />
                          </div>
                          <span className="h-3 w-12 bg-muted rounded animate-pulse shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : recentReports.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {recentReports.map((r, i) => (
                        <Link
                          key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}
                          href={`/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`}
                          className="group flex flex-col rounded-lg border border-border bg-background p-3 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground truncate flex-1 group-hover:text-primary transition-colors">
                              {r.keyword}
                            </p>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="mt-2 flex flex-col gap-2">
                            <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                              {r.opportunity_score != null && r.analysis_status !== 'analyzing' && (
                                <span className="inline-flex items-center gap-1">
                                  <Target className="h-3.5 w-3.5 text-primary shrink-0" />
                                  기회 점수 {r.opportunity_score}
                                </span>
                              )}
                              <span><TimeAgo isoString={r.created_at} /></span>
                              {r.analysis_status && r.analysis_status !== 'analyzing' && (
                                <span className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                  r.analysis_status === 'completed' && 'bg-emerald-500/10 text-emerald-600',
                                  r.analysis_status === 'failed' && 'bg-rose-500/10 text-rose-600'
                                )}>
                                  {r.analysis_status === 'completed' ? '완료' : r.analysis_status === 'failed' ? '실패' : r.analysis_status}
                                </span>
                              )}
                            </div>
                            {r.analysis_status === 'analyzing' && (() => {
                              const isCurrentAnalysis = (r.keyword?.trim() ?? '') === (currentAnalysisKeyword?.trim() ?? '')
                              const hasStepInfo = isCurrentAnalysis && (streamingState.status === 'running' || streamingState.status === 'streaming')
                              const stepNum = hasStepInfo ? (streamingState.currentStep ?? 0) + 1 : 1
                              const totalSteps = 5
                              const activityMessage = hasStepInfo
                                ? getAnalysisActivityMessage(streamingState.stepId, streamingState.currentStep)
                                : '분석을 시작했습니다...'
                              return (
                                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 space-y-1.5">
                                  <div className="flex items-center gap-2">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-600 shrink-0" />
                                    <span className="text-xs font-medium text-amber-700 dark:text-amber-500">분석 중</span>
                                  </div>
                                  <p className="text-[11px] text-muted-foreground">
                                    단계 {stepNum}/{totalSteps}: {activityMessage}
                                  </p>
                                  <div className="h-1 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-amber-500/60 rounded-full transition-all duration-500"
                                      style={{ width: `${(stepNum / totalSteps) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm py-8 text-center">
                      아직 분석 기록이 없습니다. 위에서 새 시장 분석을 시작해 보세요.
                    </p>
                  )
                ) : (
                  <p className="text-muted-foreground text-sm py-8 text-center">
                    로그인하면 최근 분석 기록이 표시됩니다.
                  </p>
                )}
              </section>
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
