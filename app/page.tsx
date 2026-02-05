'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'
import { RinAnimation, getRandomRinMessage } from '@/components/common/RinAnimation'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useResearchStore } from '@/lib/stores/research-store'

interface UsageData {
  gemini: { used: number; limit: number }
  firecrawl: { used: number; limit: number }
  supabase: { used: number; limit: number }
}

function remainingPercent(used: number, limit: number): number {
  if (limit <= 0) return 100
  return Math.max(0, 100 - (used / limit) * 100)
}

export default function RinAISearch() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [loadingMessage] = useState(() => getRandomRinMessage())
  const [lowQuotaBanner, setLowQuotaBanner] = useState<{ minRemaining: number } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let mounted = true
    fetch('/api/usage')
      .then((res) => res.json())
      .then((d: UsageData) => {
        if (!mounted) return
        const geminiRem = remainingPercent(d.gemini.used, d.gemini.limit)
        const fireRem = remainingPercent(d.firecrawl.used, d.firecrawl.limit)
        const dbRem = remainingPercent(d.supabase.used, d.supabase.limit)
        const minRemaining = Math.min(geminiRem, fireRem, dbRem)
        if (minRemaining < 10) setLowQuotaBanner({ minRemaining })
        else setLowQuotaBanner(null)
      })
      .catch(() => {})
    return () => { mounted = false }
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-white px-4 pt-14 lg:pt-0">
      {lowQuotaBanner && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-amber-500/95 px-4 py-2.5 text-sm font-medium text-amber-950 shadow-md">
          <span>린이 에너지가 부족해요 (잔여 {lowQuotaBanner.minRemaining.toFixed(0)}%)</span>
          <Link href="/dashboard/usage">
            <Button variant="outline" size="sm" className="border-amber-700 text-amber-900 hover:bg-amber-600/20">
              사용량 보기
            </Button>
          </Link>
        </div>
      )}
      <div className={lowQuotaBanner ? 'pt-12' : ''}>
      <AnimatePresence mode="wait">
        {searching ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center justify-center min-h-[60vh] w-full max-w-2xl space-y-8"
          >
            <RinAnimation variant="loading" size={280} className="shrink-0" />
            <div className="text-center space-y-2">
              <h2 className="text-xl md:text-2xl font-semibold text-foreground">
                {loadingMessage}
              </h2>
              <p className="text-muted-foreground text-sm">잠시만 기다려 주세요.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-2xl space-y-8 flex flex-col items-center"
          >
            {/* Logo/Brand */}
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-3">
                <RinLogo size={56} className="shrink-0" />
                <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
                  Rin-AI
                </h1>
              </div>
            </div>

            {error && (
              <div className="w-full p-4 rounded-[20px] bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Search Form */}
            <form onSubmit={handleSearch} className="w-full space-y-4">
              <div className="relative flex items-center gap-2 bg-card rounded-[20px] border border-border p-2 shadow-lg transition-shadow hover:shadow-md focus-within:shadow-[0_0_24px_-4px_rgba(255,184,0,0.35)]">
                <div className="flex-1 flex items-center gap-2 px-4">
                  <Search className="w-5 h-5 text-primary/80" />
                  <Input
                    type="text"
                    placeholder="검색어를 입력하세요..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                  />
                </div>
                <Button
                  type="submit"
                  size="lg"
                  className="rounded-[20px] bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8"
                >
                  검색
                </Button>
              </div>

              {/* Subtext */}
              <p className="text-center text-muted-foreground text-sm">
                린(Rin)이 오늘 어떤 최신 소식을 물어다 줄까요?
              </p>
            </form>

            {/* 로그인 유도: 비로그인 시 분석 결과 저장 안내 */}
            {!user && (
              <div className="w-full rounded-[20px] border border-border bg-muted/50 px-4 py-3 flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left hover:shadow-md transition-shadow">
                <p className="text-sm text-muted-foreground">
                  로그인하면 분석 결과를 저장할 수 있어요
                </p>
                <Link href={`/auth/login?callbackUrl=${encodeURIComponent('/')}`}>
                  <Button size="sm" className="shrink-0">
                    로그인
                  </Button>
                </Link>
              </div>
            )}

            {/* Decorative Element */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>AI가 실시간으로 신선한 정보를 찾아드립니다</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </main>
  )
}
