'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, LogOut, LogIn, Menu, X, Globe, Settings, ChevronRight } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { cn, formatTimeAgo } from '@/lib/utils'
import { showErrorToast } from '@/lib/error-toast'
import { parseJsonResponse } from '@/lib/fetch-json'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/trends', label: '국가별 트렌드', icon: Globe },
  { href: '/history', label: '내 리서치 기록', icon: History },
]

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sharedTrends, setSharedTrends] = useState<{ KR: string[]; updatedAt: string | null }>({ KR: [], updatedAt: null })

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
      setDisplayName('')
      return
    }
    fetch('/api/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { nickname?: string | null; email?: string } | null) => {
        if (data?.nickname) setDisplayName(data.nickname)
        else setDisplayName(data?.email ?? user.email ?? '')
      })
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '프로필을 불러오지 못했어요.' })
        setDisplayName(user.email ?? '')
      })
  }, [user])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    fetch('/api/trends')
      .then((res) => parseJsonResponse<{ KR?: string[]; updatedAt?: string | null }>(res))
      .then((data) => {
        setSharedTrends({
          KR: Array.isArray(data.KR) ? data.KR.slice(0, 3) : [],
          updatedAt: data.updatedAt ?? null,
        })
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드를 불러오지 못했어요.' }))
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
      isActive
        ? 'bg-primary/10 text-primary'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
    )

  const sidebarContent = (
    <>
      {/* 상단: 린(Rin) 로고 */}
      <Link
        href="/"
        className="flex h-16 items-center gap-2 border-b border-border px-5 hover:opacity-90 transition-opacity"
      >
        <RinLogo size={28} className="shrink-0 opacity-95" />
        <span className="font-semibold text-lg tracking-tight text-foreground">린(Rin)</span>
      </Link>

      {/* 중간: 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} className={linkClass(isActive)}>
              <Icon className="h-5 w-5 shrink-0 opacity-85" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* 국가별 트렌드 (공유 캐시) */}
      <div className="px-3 py-2 border-t border-border">
        <Link
          href="/trends"
          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4 shrink-0" />
            트렌드 (한국 상위)
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" />
        </Link>
        {sharedTrends.KR.length > 0 ? (
          <ul className="mt-1.5 space-y-0.5 px-3">
            {sharedTrends.KR.map((kw, i) => (
              <li key={`${kw}-${i}`}>
                <Link href={`/results?keyword=${encodeURIComponent(kw)}`} className="text-xs text-foreground hover:text-primary truncate block">
                  {kw}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-1.5 px-3 text-xs text-muted-foreground">
          최근 업데이트: {formatTimeAgo(sharedTrends.updatedAt)}
        </p>
      </div>

      {/* 하단: 설정 */}
      <div className="border-t border-border px-3 py-4">
        <Link
          href="/settings"
          className={linkClass(pathname === '/settings')}
        >
          <Settings className="h-5 w-5 shrink-0 opacity-85" />
          설정
        </Link>
        {user ? (
          <>
            <p
              className={cn(
                'mt-2 mb-2 truncate px-3',
                displayName && displayName !== (user.email ?? '')
                  ? 'text-sm font-semibold text-foreground'
                  : 'text-xs text-muted-foreground'
              )}
              title={user.email ?? ''}
            >
              {displayName || user.email || '사용자'}
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
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground mt-2"
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
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-white text-foreground shadow-sm lg:hidden"
        aria-label="메뉴 열기"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r-2 border-border bg-white text-foreground transition-transform duration-200 ease-out',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

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
