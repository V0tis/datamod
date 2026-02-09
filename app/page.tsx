'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { normalizeTrendItems, type TrendsResponse } from '@/lib/trends-types'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn, formatTimeAgo } from '@/lib/utils'
const COUNTRY_LABELS: Record<string, string> = { KR: '한국', US: '미국', JP: '일본' }
const COUNTRY_ORDER = ['KR', 'US', 'JP'] as const
const TRENDS_CACHE_TTL_MS = 24 * 60 * 60 * 1000

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
    KR: [], US: [], JP: [], updatedAt: null,
  })
  const [trendStatus, setTrendStatus] = useState<TrendsResponse['trendStatus']>(undefined)
  const [trendHours, setTrendHours] = useState<24 | 4>(24)
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<{ gemini: boolean; supabase: boolean } | null>(null)
  const [canSearch, setCanSearch] = useState<boolean | null>(null)
  const { status: researchStatus } = useResearchStore()
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

  const fetchTrends = (hours: 24 | 4, forceRefresh = false) => {
    const url = forceRefresh ? `/api/trends?hours=${hours}&refresh=1` : `/api/trends?hours=${hours}`
    setTrendsLoading(true)
    fetch(url)
      .then((res) => parseJsonResponse<TrendsResponse>(res))
      .then((data) => {
        setSharedTrends({
          KR: normalizeTrendItems(data.KR),
          US: normalizeTrendItems(data.US),
          JP: normalizeTrendItems(data.JP),
          updatedAt: data.updatedAt ?? null,
        })
        setTrendStatus(data.trendStatus)
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 데이터를 불러오지 못했어요.' }))
      .finally(() => setTrendsLoading(false))
  }

  useEffect(() => {
    fetchTrends(trendHours, false)
  }, [])

  const onTrendHoursChange = (hours: 24 | 4) => {
    if (hours === trendHours) return
    setTrendHours(hours)
    fetchTrends(hours, true)
  }

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
              {/* 카드 1: 실시간 트렌드 분석 - 24h/4h 토글 + KR/US/JP Top 5 */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    실시간 트렌드 분석
                  </h2>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onTrendHoursChange(24)}
                      disabled={trendsLoading}
                      className={cn(
                        'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1',
                        trendHours === 24
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {trendsLoading && trendHours === 24 ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      24시간
                    </button>
                    <button
                      type="button"
                      onClick={() => onTrendHoursChange(4)}
                      disabled={trendsLoading}
                      className={cn(
                        'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1',
                        trendHours === 4
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {trendsLoading && trendHours === 4 ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      4시간
                    </button>
                    <Link href="/trends" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5 ml-1">
                      전체 <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
                <div className="space-y-4">
                  {COUNTRY_ORDER.map((code) => {
                    const list = sharedTrends[code].slice(0, 5)
                    return (
                      <div key={code} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2">{COUNTRY_LABELS[code]} Top 5</p>
                        <ul className="space-y-1">
                          {list.length === 0 ? (
                            <li className="text-xs text-muted-foreground">데이터 없음</li>
                          ) : (
                            list.map((item, i) => (
                              <li key={`${code}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                                <span className="font-medium text-foreground truncate">{item.keyword}</span>
                                {item.search_volume != null && (
                                  <span className="text-muted-foreground text-xs shrink-0">{item.search_volume}</span>
                                )}
                              </li>
                            ))
                          )}
                        </ul>
                      </div>
                    )
                  })}
                </div>
                <p className="text-muted-foreground text-xs mt-3 text-center">
                  최근 업데이트: {formatTimeAgo(sharedTrends.updatedAt)}
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
                              <span className="text-muted-foreground text-xs">{formatTimeAgo(r.created_at)}</span>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
