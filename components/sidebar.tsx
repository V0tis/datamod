'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, LogOut, LogIn, Menu, X, TrendingUp } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'
import { useResearchStore } from '@/lib/stores/research-store'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/history', label: '내 리서치 기록', icon: History },
]

const TREND_MOCK: Record<'KR' | 'US' | 'JP', string[]> = {
  KR: ['명일방주 최신트렌드', '전기차 시장', 'AI 챗봇', '배터리 기술', '메타버스'],
  US: ['AI regulation', 'Electric vehicles', 'Crypto market', 'Cloud computing', 'Climate tech'],
  JP: ['AIトレンド', 'EV市場', '半導体', 'ゲーム業界', 'DX推進'],
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [trendCountry, setTrendCountry] = useState<'KR' | 'US' | 'JP'>('KR')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const startResearch = useResearchStore((s) => s.startResearch)

  const handleTrendClick = (keyword: string) => {
    startResearch(keyword)
    router.push(`/results?keyword=${encodeURIComponent(keyword)}`)
  }

  const sidebarContent = (
    <>
      <Link
        href="/"
        className="flex h-14 items-center gap-2 border-b border-border bg-white px-4 hover:opacity-90 transition-opacity"
      >
        <RinLogo size={24} className="shrink-0 opacity-95" />
        <span className="font-semibold tracking-tight text-foreground">Rin-AI</span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-80" />
              {label}
            </Link>
          )
        })}

        {/* 실시간 트렌드 */}
        <div className="mt-6 rounded-xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">실시간 트렌드</span>
          </div>
          <div className="flex gap-1 mb-2">
            {(['KR', 'US', 'JP'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setTrendCountry(code)}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  trendCountry === code
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                {code}
              </button>
            ))}
          </div>
          <ul className="space-y-1">
            {TREND_MOCK[trendCountry].map((keyword) => (
              <li key={keyword}>
                <button
                  type="button"
                  onClick={() => handleTrendClick(keyword)}
                  className="w-full text-left rounded-lg px-2 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors truncate"
                >
                  {keyword}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="border-t border-border bg-white p-3">
        {user ? (
          <>
            <p className="mb-2 truncate px-3 text-xs text-muted-foreground" title={user.email ?? ''}>
              {user.email}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogIn className="h-5 w-5 shrink-0" />
            로그인
          </Link>
        )}
      </div>
    </>
  )

  return (
    <>
      {/* Mobile: hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm lg:hidden"
        aria-label="메뉴 열기"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar: desktop always visible, mobile overlay when open */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-border bg-white text-foreground shadow-sm transition-transform duration-200 ease-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile overlay when sidebar open */}
      {mobileOpen && (
        <button
          type="button"
          aria-hidden
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
    </>
  )
}
