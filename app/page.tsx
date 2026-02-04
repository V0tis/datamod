'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Search, LogOut, History } from 'lucide-react'
import Link from 'next/link'

export default function RinAISearch() {
  const [user, setUser] = useState<User | null>(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    window.location.href = `/results?keyword=${encodeURIComponent(query.trim())}`
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="absolute top-4 right-4 flex items-center gap-2 flex-wrap justify-end">
        {user ? (
          <>
            <Link href="/history">
              <Button variant="outline" size="sm" className="gap-1 rounded-full">
                <History className="w-4 h-4" />
                내 리서치 기록
              </Button>
            </Link>
            <span className="text-sm text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1">
              <LogOut className="w-4 h-4" />
              로그아웃
            </Button>
          </>
        ) : (
          <Link href="/auth/login">
            <Button variant="outline" size="sm" className="rounded-full">
              로그인
            </Button>
          </Link>
        )}
      </div>
      <div className="w-full max-w-2xl space-y-8 flex flex-col items-center">
        {/* Logo/Brand */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <span className="text-4xl">🐕</span>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              Rin-AI
            </h1>
          </div>
        </div>

        {error && (
          <div className="w-full p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
            {error}
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="w-full space-y-4">
          <div className="relative flex items-center gap-2 bg-card rounded-full shadow-lg border border-border p-2 hover:shadow-xl transition-shadow">
            <div className="flex-1 flex items-center gap-2 px-4">
              <Search className="w-5 h-5 text-muted-foreground" />
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
              className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-8"
            >
              검색
            </Button>
          </div>

          {/* Subtext */}
          <p className="text-center text-muted-foreground text-sm">
            린(Rin)이 오늘 어떤 최신 소식을 물어다 줄까요?
          </p>
        </form>

        {/* Decorative Element */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>AI가 실시간으로 신선한 정보를 찾아드립니다</span>
        </div>
      </div>
    </main>
  )
}
