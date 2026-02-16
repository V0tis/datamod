'use client'

import React, { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, History, ChevronRight, KeyRound, CheckCircle2, XCircle, Loader2, X } from 'lucide-react'
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
  const [apiStatus, setApiStatus] = useState<{ gemini: boolean; supabase: boolean } | null>(null)
  const [canSearch, setCanSearch] = useState<boolean | null>(null)
  const { status: researchStatus } = useResearchStore()
  const startResearch = useResearchStore((s) => s.startResearch)
  const engineActive = researchStatus === 'loading'

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { gemini?: boolean; supabase?: boolean } | null) => {
        if (data) setApiStatus({ gemini: !!data.gemini, supabase: !!data.supabase })
        else setApiStatus(null)
      })
      .catch(() => setApiStatus(null))
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
        setRecentReports(list.slice(0, 5).map((r) => ({ keyword: r.keyword, created_at: r.updated_at ?? null, country_code: r.country_code ?? 'KR' })))
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
    setError(null)
    if (useResearchStore.getState().status === 'loading') {
      toast.info('이미 분석이 진행 중입니다.')
      return
    }
    setSearching(true)
    if (user) {
      try {
        const reportRes = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword: k }),
        })
        if (reportRes.ok) {
          const now = new Date().toISOString()
          setRecentReports((prev) => [{ keyword: k, created_at: now, country_code: trendCountry }, ...prev.filter((r) => r.keyword !== k)].slice(0, 5))
          fetch('/api/research/history')
            .then((res) => res.json())
            .then((data: { list?: { keyword: string; updated_at?: string | null; country_code?: string }[] }) => {
              const list = data?.list ?? []
              setRecentReports(list.slice(0, 5).map((r) => ({ keyword: r.keyword, created_at: r.updated_at ?? null, country_code: r.country_code ?? 'KR' })))
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0f1113]">
      {/* Header: 로고 | 검색창(중앙, 수평 정렬) | 로그인 */}
      <header className="sticky top-0 z-20 border-b border-border bg-white dark:bg-card dark:border-[#2d2f34] px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <RinLogo size={28} className="shrink-0 opacity-95" />
              <span className="font-semibold text-lg text-foreground dark:text-[#e1e3e6] hidden sm:inline">Rin-AI</span>
            </Link>
          </div>
          <form
            onSubmit={handleSearch}
            className="flex flex-1 max-w-xl mx-auto items-stretch gap-2 min-w-0 justify-center h-12"
            aria-busy={searching}
          >
            <div
              className={cn(
                'relative flex-1 flex items-center rounded-lg border border-border bg-muted/40 dark:bg-[#1a1c20] dark:border-[#33363b] h-full focus-within:bg-white focus-within:dark:bg-[#1a1c20] focus-within:ring-2 focus-within:ring-primary/20 focus-within:dark:ring-[#00d19a]/40 overflow-hidden min-h-[2.75rem]',
                searching && 'opacity-80 pointer-events-none'
              )}
            >
              <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-muted-foreground dark:text-slate-400" aria-hidden>
                <Search className="h-4 w-4 shrink-0" />
              </span>
              <Input
                type="search"
                aria-label="검색 키워드"
                placeholder="키워드 검색..."
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setError(null)
                }}
                disabled={searching}
                className="border-0 bg-transparent dark:bg-transparent pl-9 pr-9 h-full py-0 text-sm text-foreground dark:text-[#e1e3e6] placeholder:dark:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0 min-h-0"
              />
              {query.length > 0 && !searching && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted/80 dark:hover:bg-[#2a2d32] transition-colors"
                  aria-label="검색어 지우기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={searching}
              aria-busy={searching}
              className="shrink-0 h-full min-h-[2.75rem] px-4 dark:bg-card dark:text-[#e1e3e6] dark:hover:bg-[#2a2d32] dark:border-[#2d2f34]"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : '검색'}
            </Button>
          </form>
          <div className="w-[72px] sm:w-20 shrink-0 flex justify-end">
            {!user && (
              <Link href={`/auth/login?callbackUrl=${encodeURIComponent('/')}`}>
                <Button variant="outline" size="sm" className="h-8 text-sm dark:border-[#33363b] dark:text-[#e1e3e6] dark:hover:bg-[#2a2d32]">
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
            <div className="rounded-2xl border border-border bg-white dark:bg-card dark:border-[#2d2f34] p-8 shadow-sm">
              <RinAnimation variant="loading" size={200} className="mx-auto block" />
              <p className="text-center font-medium text-foreground dark:text-[#e1e3e6] mt-4">{loadingMessage}</p>
              <p className="text-center text-muted-foreground dark:text-slate-400 text-sm mt-1">잠시만 기다려 주세요.</p>
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
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-amber-800 dark:text-amber-200 text-sm">설정에서 Gemini API 키를 등록한 뒤 분석을 사용할 수 있습니다.</p>
                <Link href="/settings?tab=license" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50">
                    키 등록하러 가기
                  </Button>
                </Link>
              </div>
            )}

            <p className="text-muted-foreground dark:text-slate-400 text-sm mb-4 max-w-2xl">
              키워드로 시장 인사이트를 확인하고, 실시간 트렌드와 리서치 기록을 한눈에 보세요.
            </p>

            {/* 대시보드 그리드: 실시간 트렌드 넓게, 나머지 2열 */}
            <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
              {/* 카드 1: 실시간 트렌드 - 국가 칩 + Top 5~10 (번역 후 / 번역 전 함께 표시) */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card p-5 shadow-sm lg:col-span-5 transition-colors duration-200 dark:hover:bg-[#1c1e21]">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground dark:text-[#e1e3e6] flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    실시간 트렌드 분석
                  </h2>
                  <Link href="/trends" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5 dark:text-slate-400">
                    전체 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <CountryChips
                  value={trendCountry}
                  onChange={setTrendCountry}
                  updatedAt={sharedTrends.updatedAt}
                  className="mb-4"
                />
                <div className="rounded-lg border border-border/60 dark:border-[#2d2f34] bg-muted/20 dark:bg-slate-900/50 p-3">
                  {trendsLoading ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2 text-muted-foreground dark:text-slate-400 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span className="text-center">
                        {sharedTrends.updatedAt ? '정보가 오래되어 최신 트렌드를 불러오고 있습니다...' : '최신 트렌드를 불러오는 중...'}
                      </span>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {(sharedTrends[trendCountry] ?? []).slice(0, MAIN_TRENDS_TOP_N).length === 0 ? (
                        <li className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-muted dark:bg-slate-800 text-muted-foreground dark:text-slate-500 mb-2">
                            <TrendingUp className="h-5 w-5" aria-hidden />
                          </div>
                          <span className="text-sm text-muted-foreground dark:text-slate-400">트렌드 데이터가 없어요</span>
                          <span className="text-xs text-muted-foreground dark:text-slate-500 mt-0.5">잠시 후 새로고침하거나 국가를 바꿔 보세요.</span>
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
                                className="w-full flex items-center justify-between gap-2 text-sm text-left rounded-md px-2 py-1.5 hover:bg-muted/60 dark:hover:bg-[#1c1e21] transition-colors border border-transparent dark:border-[#2d2f34]/80"
                              >
                                <span className="min-w-0 flex-1 flex items-center gap-2">
                                  <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted dark:bg-[#2a2d32] text-xs font-medium text-muted-foreground dark:text-slate-400 tabular-nums">
                                    {item.rank ?? i + 1}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    {hasTranslation ? (
                                      <>
                                        <span className="font-medium text-foreground dark:text-[#e1e3e6] block truncate">
                                          {item.title_ko}
                                        </span>
                                        <span className="text-muted-foreground dark:text-slate-400 text-xs block truncate">
                                          {item.keyword}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="font-medium text-foreground dark:text-[#e1e3e6] truncate">
                                        {item.keyword}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                {item.search_volume != null && (
                                  <span className="text-muted-foreground dark:text-slate-400 text-xs shrink-0 tabular-nums">
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
                <p className="text-muted-foreground text-xs mt-2 text-center text-amber-700/90 dark:text-amber-300/90">
                  RSS 데이터는 실시간 업데이트 주기를 따릅니다.
                </p>
              </div>

              {/* 카드 2: 나의 리서치 활동 */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card p-5 shadow-sm lg:col-span-4 transition-colors duration-200 dark:hover:bg-[#1c1e21]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground dark:text-[#e1e3e6] flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    나의 리서치 활동
                  </h2>
                  <Link href="/history" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5 dark:text-slate-400">
                    전체 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {user ? (
                  recentReportsLoading ? (
                    <div className="space-y-2" aria-busy="true" aria-label="리서치 기록 불러오는 중">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg border border-border dark:border-[#2d2f34] bg-muted/30 dark:bg-card px-3 py-2.5">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="h-4 w-28 bg-muted dark:bg-zinc-700 rounded animate-pulse" />
                            <span className="h-3 w-8 bg-muted dark:bg-zinc-700 rounded animate-pulse shrink-0" />
                          </div>
                          <span className="h-3 w-12 bg-muted dark:bg-zinc-700 rounded animate-pulse shrink-0" />
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground dark:text-slate-500 text-center pt-1">불러오는 중...</p>
                    </div>
                  ) : recentReports.length > 0 ? (
                    <ul className="space-y-2">
                      {recentReports.map((r, i) => (
                        <li key={r.keyword + (r.created_at ?? '') + (r.country_code ?? '') + i}>
                          <Link
                            href={`/results?keyword=${encodeURIComponent(r.keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`}
                            className="flex items-center justify-between rounded-lg border border-border dark:border-[#2d2f34] bg-muted/30 dark:bg-card px-3 py-2.5 text-sm hover:bg-muted/50 dark:hover:bg-[#1c1e21] transition-colors"
                          >
                            <span className="min-w-0 flex items-center gap-2">
                              <span className="font-medium text-foreground dark:text-[#e1e3e6] truncate">{r.keyword}</span>
                              <span className="shrink-0 text-xs text-muted-foreground dark:text-slate-400" title="트렌드 채택 국가">
                                {COUNTRY_LABELS[r.country_code] ?? r.country_code}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 shrink-0">
                              <TimeAgo isoString={r.created_at} className="text-muted-foreground dark:text-slate-400 text-xs" />
                              <ChevronRight className="h-4 w-4 text-muted-foreground dark:text-slate-400" />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground dark:text-slate-400 text-sm py-6 text-center">
                      아직 검색 기록이 없어요.
                    </p>
                  )
                ) : (
                  <p className="text-muted-foreground dark:text-slate-400 text-sm py-6 text-center">
                    로그인하면 최근 검색 키워드가 표시돼요.
                  </p>
                )}
              </div>

              {/* 카드 3: API 키 연결 상태 */}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-card p-5 shadow-sm lg:col-span-3 transition-colors duration-200 dark:hover:bg-[#1c1e21]">
                <h2 className="font-semibold text-foreground dark:text-white flex items-center gap-2 mb-4">
                  <KeyRound className="h-5 w-5 text-primary" />
                  API 연결 상태
                </h2>
                <ul className="space-y-3">
                  {apiStatus ? (
                    <>
                      <li className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground dark:text-slate-400">Gemini</span>
                        {apiStatus.gemini ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4 shrink-0" /> 연결됨</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground dark:text-slate-400"><XCircle className="h-4 w-4" /> 미설정</span>
                        )}
                      </li>
                      <li className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground dark:text-slate-400">Supabase</span>
                        {apiStatus.supabase ? (
                          <span className="flex items-center gap-1 text-green-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4 shrink-0" /> 연결됨</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground dark:text-slate-400"><XCircle className="h-4 w-4" /> 미설정</span>
                        )}
                      </li>
                    </>
                  ) : (
                    <li className="text-sm text-muted-foreground dark:text-slate-400">연결 상태 확인 중...</li>
                  )}
                </ul>
              </div>
            </div>

            <TrendDetailPanel
              open={trendPanelOpen}
              onOpenChange={setTrendPanelOpen}
              selectedItem={selectedTrendItem}
              onAnalyze={(keyword) => {
                startResearch(keyword, { country_code: trendCountry })
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
