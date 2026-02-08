'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, TrendingUp, History, Zap, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { showErrorToast } from '@/lib/error-toast'
import { parseJsonResponse } from '@/lib/fetch-json'
import { useResearchStore } from '@/lib/stores/research-store'
import { cn, formatTimeAgo } from '@/lib/utils'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface UsageData {
  gemini: { used: number; limit: number }
  firecrawl: { used: number; limit: number }
  supabase: { used: number; limit: number }
}

function remainingPercent(used: number, limit: number): number {
  if (limit <= 0) return 100
  return Math.max(0, 100 - (used / limit) * 100)
}

const TREND_PIE_COLORS = ['#2563eb', '#22c55e', '#f59e0b'] as const
const TREND_PIE_NAMES = ['한국', '미국', '일본'] as const

export default function RinAISearch() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage] = useState(() => getRandomRinMessage())
  const [recentKeywords, setRecentKeywords] = useState<string[]>([])
  const [licenseOrigin, setLicenseOrigin] = useState<'USER' | 'SYSTEM' | null>(null)
  const [sharedTrends, setSharedTrends] = useState<{ KR: string[]; US: string[]; JP: string[]; updatedAt: string | null }>({
    KR: [], US: [], JP: [], updatedAt: null,
  })
  const { geminiQuota, fetchGeminiQuota } = useResearchStore()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetchGeminiQuota()
  }, [fetchGeminiQuota])

  useEffect(() => {
    if (!user) {
      setLicenseOrigin(null)
      return
    }
    fetch('/api/settings')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { licenseOrigin?: { gemini: string; firecrawl: string } } | null) => {
        if (!data?.licenseOrigin) return
        const { gemini, firecrawl } = data.licenseOrigin
        if (gemini === 'USER' && firecrawl === 'USER') setLicenseOrigin('USER')
        else setLicenseOrigin('SYSTEM')
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '설정 정보를 불러오지 못했어요.' })
        setLicenseOrigin(null)
      })
  }, [user])

  useEffect(() => {
    if (!user) {
      setRecentKeywords([])
      return
    }
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data: { reports?: { keyword: string }[] }) => {
        const list = data?.reports ?? []
        const keywords = [...new Set(list.map((r) => r.keyword).filter(Boolean))].slice(0, 3)
        setRecentKeywords(keywords)
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '최근 검색어를 불러오지 못했어요.' })
        setRecentKeywords([])
      })
  }, [user])

  useEffect(() => {
    fetch('/api/trends')
      .then((res) => parseJsonResponse<{ KR?: string[]; US?: string[]; JP?: string[]; updatedAt?: string | null }>(res))
      .then((data) => {
        setSharedTrends({
          KR: Array.isArray(data.KR) ? data.KR : [],
          US: Array.isArray(data.US) ? data.US : [],
          JP: Array.isArray(data.JP) ? data.JP : [],
          updatedAt: data.updatedAt ?? null,
        })
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 데이터를 불러오지 못했어요.' }))
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    if (useResearchStore.getState().status === 'loading') {
      toast.info('린이 이미 열심히 분석 중이에요!')
      return
    }
    setSearching(true)
    router.push(`/results?keyword=${encodeURIComponent(query.trim())}`)
  }

  const used = geminiQuota?.used ?? 0
  const limit = geminiQuota?.limit ?? 1500
  const remainingPct = remainingPercent(used, limit)

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      {/* Header: 로고 + 검색창 (상단 작게) */}
      <header className="sticky top-0 z-20 border-b border-border bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <RinLogo size={28} className="shrink-0 opacity-95" />
              <span className="font-semibold text-lg text-foreground hidden sm:inline">Rin-AI</span>
            </Link>
            {user && licenseOrigin && (
              <span
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  licenseOrigin === 'USER'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {licenseOrigin === 'USER' ? '개인 자원 사용 중' : '서버 자원 사용 중'}
              </span>
            )}
          </div>
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2 max-w-xl">
            <div className="relative flex-1 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                type="text"
                placeholder="키워드 검색..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="border-0 bg-transparent p-0 h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <Button type="submit" size="sm" className="shrink-0 h-8 px-4">
              검색
            </Button>
          </form>
          {!user && (
            <Link href={`/auth/login?callbackUrl=${encodeURIComponent('/')}`} className="shrink-0">
              <Button variant="outline" size="sm" className="h-8 text-sm">
                로그인
              </Button>
            </Link>
          )}
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

            {/* 대시보드 그리드: 3열 카드 */}
            <div className="mx-auto max-w-6xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 카드 1: 실시간 트렌드 분석 (도넛) - 공유 캐시 데이터 */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    실시간 트렌드 분석
                  </h2>
                  <Link href="/trends" className="text-primary text-sm font-medium hover:underline flex items-center gap-0.5">
                    전체 <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const kr = sharedTrends.KR.length
                          const us = sharedTrends.US.length
                          const jp = sharedTrends.JP.length
                          const total = kr + us + jp
                          const v = total === 0 ? [1, 1, 1] : [kr, us, jp]
                          return TREND_PIE_NAMES.map((name, i) => ({
                            name,
                            value: v[i],
                            color: TREND_PIE_COLORS[i],
                          }))
                        })()}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {TREND_PIE_NAMES.map((_, i) => (
                          <Cell key={i} fill={TREND_PIE_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value}건`, '키워드 수']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-muted-foreground text-xs text-center mt-1">
                  국가별 인기 키워드 비중 · 최근 업데이트: {formatTimeAgo(sharedTrends.updatedAt)}
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
                  recentKeywords.length > 0 ? (
                    <ul className="space-y-2">
                      {recentKeywords.map((kw, i) => (
                        <li key={kw}>
                          <Link
                            href={`/results?keyword=${encodeURIComponent(kw)}`}
                            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                          >
                            <span className="font-medium text-foreground truncate">{kw}</span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
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

              {/* 카드 3: AI 에너지 현황 (상단 에너지 바를 카드로) */}
              <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5 text-primary" />
                  AI 에너지 현황
                </h2>
                <div className="space-y-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-3xl font-bold text-foreground tabular-nums">
                      {Math.round(remainingPct)}%
                    </span>
                    <span className="text-sm text-muted-foreground">잔여</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${remainingPct}%`,
                        backgroundColor:
                          remainingPct >= 50 ? '#22c55e' : remainingPct >= 20 ? '#f59e0b' : '#ef4444',
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>사용 {used.toLocaleString()}</span>
                    <span>한도 {limit.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
