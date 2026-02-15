'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, LogOut, Menu, X, Settings, Cpu } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'
import { showErrorToast } from '@/lib/error-toast'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/history', label: '내 리서치 기록', icon: History },
]

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState<string>('')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [systemModalOpen, setSystemModalOpen] = useState(false)
  const [systemInfo, setSystemInfo] = useState<{ model?: string } | null>(null)

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

  const openSystemModal = () => {
    setSystemModalOpen(true)
    fetch('/api/health')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { model?: string } | null) => setSystemInfo(data ?? null))
      .catch(() => setSystemInfo(null))
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const linkClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
      isActive
        ? 'bg-primary/10 text-primary dark:bg-[var(--sidebar-active)] dark:text-[var(--sidebar-primary)]'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:text-[var(--sidebar-fg-muted)] dark:hover:bg-[var(--sidebar-accent)] dark:hover:text-[var(--sidebar-foreground)]'
    )

  const sidebarContent = (
    <>
      {/* 상단: 로고 + 테마 스위처(우측) */}
      <div className="border-b border-border px-5 py-3 flex h-12 items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity min-w-0">
          <RinLogo size={28} className="shrink-0 opacity-95" />
          <span className="font-semibold text-lg tracking-tight text-foreground truncate">린(Rin)</span>
        </Link>
        <ThemeSwitcher className="shrink-0" />
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
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

      {/* 하단: System + 설정 + 로그아웃 */}
      <div className="border-t border-border px-3 py-4 space-y-1">
        <button
          type="button"
          onClick={openSystemModal}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
            'text-muted-foreground hover:bg-muted hover:text-foreground dark:text-[var(--sidebar-fg-muted)] dark:hover:bg-[var(--sidebar-accent)] dark:hover:text-[var(--sidebar-foreground)]'
          )}
          title="연결된 AI 모델 정보"
        >
          <Cpu className="h-5 w-5 shrink-0 opacity-85" />
          System
        </button>
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
                  ? 'text-sm font-bold text-foreground dark:text-[var(--sidebar-foreground)]'
                  : 'text-xs text-muted-foreground dark:text-[var(--sidebar-fg-muted)]'
              )}
              title={user.email ?? ''}
            >
              {displayName || user.email || '사용자'}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted hover:text-foreground dark:text-[var(--sidebar-fg-muted)] dark:hover:bg-rose-500/10 dark:hover:text-rose-400'
              )}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              로그아웃
            </button>
          </>
        ) : null}
      </div>
    </>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background dark:bg-sidebar text-foreground dark:text-sidebar-foreground shadow-sm lg:hidden"
        aria-label="메뉴 열기"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r-2 border-border bg-background dark:bg-sidebar text-foreground dark:text-sidebar-foreground transition-transform duration-200 ease-out',
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

      {/* 시스템 설정 모달: 연결된 AI 모델 정보 */}
      {systemModalOpen && (
        <>
          <button
            type="button"
            aria-hidden
            className="fixed inset-0 z-50 bg-black/30"
            onClick={() => setSystemModalOpen(false)}
          />
          <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                시스템 정보
              </h3>
              <button
                type="button"
                onClick={() => setSystemModalOpen(false)}
                className="p-1 rounded hover:bg-muted"
                aria-label="닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">연결된 AI 모델</p>
            <p className="font-mono text-sm text-card-foreground mb-4">
              {systemInfo?.model ?? '확인 중...'}
            </p>
            <Link
              href="/settings"
              onClick={() => setSystemModalOpen(false)}
              className="text-primary text-sm font-medium hover:underline"
            >
              설정에서 API 키 관리 →
            </Link>
          </div>
        </>
      )}
    </>
  )
}
