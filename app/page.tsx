'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, History, ChevronRight, Loader2, X } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/time-ago'
import { CountryChips, COUNTRY_CHIP_CODES, COUNTRY_LABELS, type CountryChipCode } from '@/components/country-chips'
import { TrendDetailPanel } from '@/components/trend-detail-panel'

const MAIN_TRENDS_TOP_N = 10
const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'

function RinAISearchInner() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage] = useState(() => getRandomRinMessage())
  const [recentReports, setRecentReports] = useState<{ keyword: string; created_at: string | null; country_code: string }[]>([])
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
  const [trendCountry, setTrendCountryState] = useState<CountryChipCode>(() => {
    if (typeof window === 'undefined') return 'KR'
    const saved = window.localStorage.getItem(TRENDS_COUNTRY_STORAGE_KEY)
    return saved && (COUNTRY_CHIP_CODES as readonly string[]).includes(saved)
      ? (saved as CountryChipCode)
      : 'KR'
  })
  const [trendPanelOpen, setTrendPanelOpen] = useState(false)
  const [selectedTrendItem, setSelectedTrendItem] = useState<TrendItem | null>(null)

  useEffect(() => {
    const c = searchParams.get('country')
    if (c && (COUNTRY_CHIP_CODES as readonly string[]).includes(c)) {
      setTrendCountryState(c as CountryChipCode)
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
    router.replace(`/?country=${code}`)
  }
  const [canSearch, setCanSearch] = useState<boolean | null>(null)
  const jobs = useResearchStore((s) => s.jobs)
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const abortAnalysis = useResearchStore((s) => s.abortAnalysis)
  const streamingState = useResearchStore((s) => s.streamingState)
  const isAnalyzingNow = useResearchStore((s) => s.isAnalyzingNow)
  const engineActive = Object.values(jobs).some((job) => job.status === 'queued' || job.status === 'running') || isAnalyzingNow()

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
      .then((data: { list?: { keyword: string; updated_at?: string | null; country_code?: string }[] }) => {
        const list = data?.list ?? []
        setRecentReports(list.slice(0, 3).map((r) => ({ keyword: r.keyword, created_at: r.updated_at ?? null, country_code: r.country_code ?? 'KR' })))
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
          setRecentReports((prev) => [{ keyword: k, created_at: now, country_code: trendCountry }, ...prev.filter((r) => r.keyword !== k)].slice(0, 3))
          fetch('/api/research/history')
            .then((res) => res.json())
            .then((data: { list?: { keyword: string; updated_at?: string | null; country_code?: string }[] }) => {
              const list = data?.list ?? []
              setRecentReports(list.slice(0, 3).map((r) => ({ keyword: r.keyword, created_at: r.updated_at ?? null, country_code: r.country_code ?? 'KR' })))
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
    if (searching || isAnalyzingNow()) {
      const state = streamingState
      if (state.status === 'running' || state.status === 'streaming') {
        return `분석 중... (${state.currentStep + 1}/5)`
      }
      return '분석 중...'
    }
    return '시장·제품 분석'
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header: 로고 | 로그인 (검색바 제거, 단일 진입점으로 통합) */}
      <header className="sticky top-0 z-20 border-b border-border bg-card px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <RinLogo size={28} className="shrink-0 opacity-95" />
            <span className="font-semibold text-lg text-foreground hidden sm:inline">Rin-AI</span>
          </Link>
          <div className="shrink-0 flex justify-end">
            {!user && (
              <Link href={`/auth/login?callbackUrl=${encodeURIComponent('/')}`}>
                <Button variant="outline" size="sm" className="h-8 text-sm">
                  로그인
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] p-8"
          >
            <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
              <RinAnimation variant="loading" size={200} className="mx-auto block" />
              <p className="text-center font-medium text-foreground mt-4">{loadingMessage}</p>
              <p className="text-center text-muted-foreground text-sm mt-1">잠시만 기다려 주세요.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-6 md:p-8"
          >
            {error && (
              <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
                {error}
              </div>
            )}

            {user && canSearch === false && (
              <div className="mb-6 rounded-xl border border-warning/30 bg-warning/5 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-warning text-sm">설정에서 Gemini API 키를 등록한 뒤 분석을 사용할 수 있습니다.</p>
                <Link href="/settings?tab=license" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-warning text-warning hover:bg-warning/10">
                    키 등록하러 가기
                  </Button>
                </Link>
              </div>
            )}

            {/* Primary Analysis Input */}
            <div className="mb-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="max-w-2xl mx-auto space-y-5">
                <div className="text-center">
                  <h1 className="text-2xl font-bold text-foreground mb-2">Analyze a Market or Product</h1>
                  <p className="text-muted-foreground text-sm">
                    시장이나 제품을 입력하고, PM 전략 분석을 시작하세요.
                  </p>
                </div>

                {/* Large Search Input */}
                <form onSubmit={handleSearch} className="space-y-4">
                  <div
                    className={cn(
                      'relative flex items-center rounded-xl border-2 border-border bg-background h-14 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10 overflow-hidden transition-all',
                      (searching || isAnalyzingNow()) && 'opacity-80'
                    )}
                  >
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-muted-foreground" aria-hidden>
                      <Search className="h-5 w-5 shrink-0" />
                    </span>
                    <Input
                      type="search"
                      aria-label="검색 키워드"
                      placeholder="분석할 키워드를 입력하세요..."
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value)
                        setError(null)
                      }}
                      disabled={searching || isAnalyzingNow()}
                      className="border-0 bg-transparent pl-12 pr-4 h-full py-0 text-base text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0"
                    />
                    {query.length > 0 && !searching && !isAnalyzingNow() && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        aria-label="검색어 지우기"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1" />
                    {(searching || isAnalyzingNow()) ? (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleAbort}
                        className="h-10 px-6"
                      >
                        <X className="h-4 w-4 mr-2" />
                        분석 중단
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={!query.trim()}
                        className="h-10 px-6"
                      >
                        {getButtonLabel()}
                      </Button>
                    )}
                  </div>
                </form>

                {/* Progress Indicator */}
                {(searching || isAnalyzingNow()) && streamingState.status !== 'idle' && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {getButtonLabel()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          시장 데이터 수집 → 트렌드 분석 → 리스크·전략·액션 도출
                        </p>
                      </div>
                    </div>
                    {(streamingState.status === 'running' || streamingState.status === 'streaming') && (
                      <div className="mt-3">
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
            </div>

            {/* Decision flow: Primary Analysis | Recent Analyses (3) | Market Trends Snapshot */}
            <div className="mx-auto max-w-6xl space-y-6">
              {/* Recent Analyses (latest 3) */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors duration-200 hover:bg-background-elevated">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    Recent Analyses
                  </h2>
                  <Link href="/history" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5">
                    전체 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {user ? (
                  recentReportsLoading ? (
                    <div className="space-y-2" aria-busy="true" aria-label="최근 분석 불러오는 중">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="h-4 w-28 bg-muted rounded animate-pulse" />
                            <span className="h-3 w-8 bg-muted rounded animate-pulse shrink-0" />
                          </div>
                          <span className="h-3 w-12 bg-muted rounded animate-pulse shrink-0" />
                        </div>
                      ))}
                    </div>
                  ) : recentReports.length > 0 ? (
                    <ul className="space-y-2">
                      {recentReports.map((r, i) => (
                        <li key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}>
                          <Link
                            href={`/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted-hover transition-colors"
                          >
                            <span className="min-w-0 flex items-center gap-2">
                              <span className="font-medium text-foreground truncate">{r.keyword}</span>
                              <span className="shrink-0 text-xs text-muted-foreground" title="트렌드 채택 국가">
                                {COUNTRY_LABELS[r.country_code] ?? r.country_code}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <TimeAgo isoString={r.created_at} className="text-muted-foreground text-xs" />
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm py-6 text-center">
                      아직 분석 기록이 없어요. 위에서 분석을 시작하세요.
                    </p>
                  )
                ) : (
                  <p className="text-muted-foreground text-sm py-6 text-center">
                    로그인하면 최근 분석이 표시됩니다.
                  </p>
                )}
              </div>

              {/* Market Trends Snapshot */}
              <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-colors duration-200 hover:bg-background-elevated">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Market Trends Snapshot
                  </h2>
                  <Link href="/trends" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5">
                    전체 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <CountryChips
                  value={trendCountry}
                  onChange={setTrendCountry}
                  updatedAt={sharedTrends.updatedAt}
                  className="mb-4"
                />
                <div className="rounded-lg border border-border bg-muted/20 p-3">
                  {trendsLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span className="text-center">
                        {sharedTrends.updatedAt ? '정보가 오래되어 최신 트렌드를 불러오고 있습니다...' : '최신 트렌드를 불러오는 중...'}
                      </span>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {(sharedTrends[trendCountry] ?? []).slice(0, MAIN_TRENDS_TOP_N).length === 0 ? (
                        <li className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground mb-2">
                            <TrendingUp className="h-5 w-5" aria-hidden />
                          </div>
                          <span className="text-sm text-muted-foreground">트렌드 데이터가 없어요</span>
                          <span className="text-xs text-muted-foreground mt-0.5">잠시 후 새로고침하거나 국가를 바꿔 보세요.</span>
                        </li>
                      ) : (
                        (sharedTrends[trendCountry] ?? []).slice(0, MAIN_TRENDS_TOP_N).map((item, i) => {
                          const hasTranslation = item.title_ko != null && item.title_ko !== item.keyword
                          return (
                            <li key={`${trendCountry}-${i}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedTrendItem(item)
                                  setTrendPanelOpen(true)
                                }}
                                className="w-full flex items-center justify-between gap-2 text-sm text-left rounded-md px-2 py-1.5 hover:bg-muted-hover transition-colors border border-transparent"
                              >
                                <span className="min-w-0 flex-1 flex items-center gap-2">
                                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted-hover text-xs font-medium text-muted-foreground tabular-nums">
                                    {item.rank ?? i + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    {hasTranslation ? (
                                      <>
                                        <span className="font-medium text-foreground block truncate">
                                          {item.title_ko}
                                        </span>
                                        <span className="text-muted-foreground text-xs block truncate">
                                          {item.keyword}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-medium text-foreground truncate">
                                        {item.keyword}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                {item.search_volume != null && (
                                  <span className="text-muted-foreground text-xs shrink-0 tabular-nums">
                                    {item.search_volume}
                                  </span>
                                )}
                              </button>
                            </li>
                          )
                        })
                      )}
                    </ul>
                  )}
                </div>
                <p className="text-muted-foreground text-xs mt-2 text-center text-warning/90">
                  RSS 데이터는 실시간 업데이트 주기를 따릅니다.
                </p>
              </div>
            </div>

            <TrendDetailPanel
              open={trendPanelOpen}
              onOpenChange={setTrendPanelOpen}
              selectedItem={selectedTrendItem}
              onAnalyze={(keyword) => {
                startStreamingResearch(keyword, { country_code: trendCountry })
                router.push(`/results?keyword=${encodeURIComponent(keyword)}&country=${encodeURIComponent(trendCountry)}`)
              }}
            />
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
