'use client'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, History, ChevronRight, KeyRound, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
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
import { CountryChips, COUNTRY_CHIP_CODES, type CountryChipCode } from '@/components/country-chips'
import { TrendDetailPanel } from '@/components/trend-detail-panel'

const MAIN_TRENDS_TOP_N = 10
const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'

export default function RinAISearch() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage] = useState(() => getRandomRinMessage())
  const [recentReports, setRecentReports] = useState<{ keyword: string; created_at: string | null }[]>([])
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
        showErrorToast(err, { fallbackMessage: '설정 정보를 불러오지 못했어요.' })
        setLicenseOrigin(null)
        setCanSearch(null)
      })
  }, [user])

  useEffect(() => {
    if (!user) {
      setRecentReports([])
      return
    }
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data: { reports?: { keyword: string; created_at?: string | null }[] }) => {
        const list = data?.reports ?? []
        setRecentReports(list.slice(0, 5).map((r) => ({ keyword: r.keyword, created_at: r.created_at ?? null })))
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '최근 검색어를 불러오지 못했어요.' })
        setRecentReports([])
      })
  }, [user])

  const fetchTrends = (forceRefresh = false) => {
    const url = forceRefresh ? '/api/trends?refresh=1' : '/api/trends'
    setTrendsLoading(true)
    fetch(url)
      .then((res) => parseJsonResponse<TrendsResponse>(res))
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
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 데이터를 불러오지 못했어요.' }))
      .finally(() => setTrendsLoading(false))
  }

  useEffect(() => {
    fetchTrends(false)
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    const k = query.trim()
    if (!k) return
    if (useResearchStore.getState().status === 'loading') {
      toast.info('린이 이미 열심히 분석 중이에요!')
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
          setRecentReports((prev) => [{ keyword: k, created_at: now }, ...prev.filter((r) => r.keyword !== k)].slice(0, 5))
          const listRes = await fetch('/api/reports')
          const listData = await listRes.json().catch(() => ({}))
          const list = listData?.reports ?? []
          setRecentReports(list.slice(0, 5).map((r: { keyword: string; created_at?: string | null }) => ({ keyword: r.keyword, created_at: r.created_at ?? null })))
        } else {
          const err = await reportRes.json().catch(() => ({}))
          toast.error(err?.error ?? '검색 기록 저장에 실패했어요.')
        }
      } catch {
        toast.error('검색 기록 저장에 실패했어요.')
      }
    }
    router.push(`/results?keyword=${encodeURIComponent(k)}`)
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header: 로고 | 검색창(중앙, 수평 정렬) | 로그인 */}
      <header className="sticky top-0 z-20 border-b border-border bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <Link href="/" className="flex items-center gap-2">
              <RinLogo size={28} className="shrink-0 opacity-95" />
              <span className="font-semibold text-lg text-foreground hidden sm:inline">Rin-AI</span>
            </Link>
          </div>
          <form onSubmit={handleSearch} className="flex flex-1 max-w-xl mx-auto items-stretch gap-2 min-w-0 justify-center h-12">
            <div className="relative flex-1 flex items-center rounded-lg border border-border bg-muted/40 h-full focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20 overflow-hidden min-h-[2.75rem]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none text-muted-foreground">
                <Search className="h-4 w-4 shrink-0" />
              </span>
              <Input
                type="text"
                placeholder="키워드 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 bg-transparent pl-9 pr-3 h-full py-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 flex-1 min-w-0 min-h-0"
              />
            </div>
            <Button type="submit" size="sm" className="shrink-0 h-full min-h-[2.75rem] px-4">
              검색
            </Button>
          </form>
          <div className="w-[72px] sm:w-20 shrink-0 flex justify-end">
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
            <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
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
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <p className="text-amber-800 dark:text-amber-200 text-sm">키를 등록해 주세요. 분석을 사용하려면 설정에서 Gemini API 키를 등록해야 해요.</p>
                <Link href="/settings" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/50">
                    키 등록하러 가기
                  </Button>
                </Link>
              </div>
            )}

            {/* 대시보드 그리드: 3열 카드 */}
            <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 카드 1: 실시간 트렌드 - 국가 칩 + Top 5~10 (번역본 위주) */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    실시간 트렌드 분석
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
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                  {trendsLoading ? (
                    <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중...
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {(sharedTrends[trendCountry] ?? []).slice(0, MAIN_TRENDS_TOP_N).length === 0 ? (
                        <li className="text-xs text-muted-foreground py-2">데이터 없음</li>
                      ) : (
                        (sharedTrends[trendCountry] ?? []).slice(0, MAIN_TRENDS_TOP_N).map((item, i) => (
                          <li key={`${trendCountry}-${i}`}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTrendItem(item)
                                setTrendPanelOpen(true)
                              }}
                              className="w-full flex items-center justify-between gap-2 text-sm text-left rounded-md px-2 py-1.5 hover:bg-muted/60 transition-colors"
                            >
                              <span className="font-medium text-foreground truncate">
                                {item.title_ko ?? item.keyword}
                              </span>
                              {item.search_volume != null && (
                                <span className="text-muted-foreground text-xs shrink-0 tabular-nums">
                                  {item.search_volume}
                                </span>
                              )}
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
                <p className="text-muted-foreground text-xs mt-2 text-center text-amber-700/90 dark:text-amber-300/90">
                  RSS 데이터는 실시간 업데이트 주기를 따릅니다.
                </p>
              </div>

              {/* 카드 2: 나의 리서치 활동 */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    나의 리서치 활동
                  </h2>
                  <Link href="/history" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5">
                    전체 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                {user ? (
                  recentReports.length > 0 ? (
                    <ul className="space-y-2">
                      {recentReports.map((r, i) => (
                        <li key={r.keyword + (r.created_at ?? '') + i}>
                          <Link
                            href={`/results?keyword=${encodeURIComponent(r.keyword)}`}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                          >
                            <span className="font-medium text-foreground truncate">{r.keyword}</span>
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
                      아직 검색 기록이 없어요.
                    </p>
                  )
                ) : (
                  <p className="text-muted-foreground text-sm py-6 text-center">
                    로그인하면 최근 검색 키워드가 표시돼요.
                  </p>
                )}
              </div>

              {/* 카드 3: API 키 연결 상태 */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  <KeyRound className="h-5 w-5 text-primary" />
                  API 연결 상태
                </h2>
                <ul className="space-y-3">
                  {apiStatus ? (
                    <>
                      <li className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Gemini</span>
                        {apiStatus.gemini ? (
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" /> 연결됨</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4" /> 미설정</span>
                        )}
                      </li>
                      <li className="flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">Supabase</span>
                        {apiStatus.supabase ? (
                          <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" /> 연결됨</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground"><XCircle className="h-4 w-4" /> 미설정</span>
                        )}
                      </li>
                    </>
                  ) : (
                    <li className="text-sm text-muted-foreground">연결 상태 확인 중...</li>
                  )}
                </ul>
              </div>
            </div>

            <TrendDetailPanel
              open={trendPanelOpen}
              onOpenChange={setTrendPanelOpen}
              selectedItem={selectedTrendItem}
              onAnalyze={(keyword) => {
                startResearch(keyword)
                router.push(`/results?keyword=${encodeURIComponent(keyword)}`)
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
