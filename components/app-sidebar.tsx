'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  Bookmark,
  BarChart3,
} from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'
import { motionConfig } from '@/lib/motion-config'
import { useLogout } from '@/components/providers/logout-provider'

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard, tooltip: '키워드 검색 및 새 분석 시작' },
  { href: '/history', label: '분석 기록', icon: BarChart3, tooltip: '과거 리서치 결과 관리 및 조회' },
  { href: '/insights', label: '저장한 인사이트', icon: Bookmark, tooltip: '북마크한 인사이트 모아보기' },
  { href: '/settings', label: '설정', icon: Settings, tooltip: 'API 키, 프로필 및 분석 설정' },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { logout, isLoggingOut } = useLogout()
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const isActive = (item: (typeof navItems)[0]) => {
    if (item.href === '/') return pathname === '/' || pathname === ''
    return pathname === item.href || pathname?.startsWith(item.href + '/')
  }

  const isResultsPage = pathname?.startsWith('/results')

  const sidebarContent = (
    <div className="flex h-full w-full flex-col">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          <RinLogo size={24} className="shrink-0" />
          <span className="font-semibold text-foreground text-sm tracking-tight">rin-ai</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="메인 메뉴">
        <ul className="space-y-1" role="list">
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <li key={item.href + item.label} className="relative">
                {/* Animated active indicator */}
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={{ opacity: active ? 1 : 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full bg-primary"
                />
                <Link href={item.href} title={item.tooltip} className="block">
                  <motion.span
                    layout={false}
                    whileHover={{
                      x: motionConfig.navHover.x,
                      transition: motionConfig.navHover.transition,
                    }}
                    className={cn(
                      'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                      'border-l-2 -ml-px pl-[11px] transition-colors duration-200',
                      active
                        ? 'border-primary bg-muted text-foreground'
                        : 'border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0 transition-colors duration-200',
                        active ? 'text-foreground' : 'opacity-70'
                      )}
                    />
                    {item.label}
                  </motion.span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer: theme + user + sign out */}
      <div className="shrink-0 border-t border-border/60 px-3 py-4 space-y-3">
        <div className="flex justify-between items-center px-1">
          <span className="text-xs text-muted-foreground">테마</span>
          <ThemeSwitcher />
        </div>
        {user ? (
          <div className="space-y-1">
            <p className="truncate px-3 py-1.5 text-xs text-muted-foreground" title={user.email ?? ''}>
              {user.email ?? 'User'}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              title="로그아웃"
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-70" />
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            title="로그인"
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-70" />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  const topbarContent = (
    <div className="flex h-14 min-h-[3.5rem] max-h-14 w-full items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 border-b border-border bg-card">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0 overflow-x-auto">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
          <RinLogo size={22} className="shrink-0" />
          <span className="font-semibold text-foreground text-sm tracking-tight">rin-ai</span>
        </Link>
        <nav className="flex items-center gap-1 shrink-0" aria-label="메인 메뉴">
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                title={item.tooltip}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200',
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0 transition-colors duration-200', active ? 'text-foreground' : 'opacity-70')} />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <ThemeSwitcher />
        {user ? (
          <>
            <span className="truncate max-w-[140px] text-xs text-muted-foreground" title={user.email ?? ''}>
              {user.email ?? 'User'}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              title="로그아웃"
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-70" />
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/login"
            title="로그인"
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-70" />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  if (isResultsPage) {
    return (
      <header className="fixed left-0 right-0 top-0 z-40 h-14 shrink-0 border-b border-border bg-card overflow-hidden">
        {topbarContent}
      </header>
    )
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground lg:hidden"
        aria-label="메뉴 열기"
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-[220px] flex-col border-r border-border bg-card',
          'lg:flex lg:translate-x-0',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'flex translate-x-0' : 'hidden -translate-x-full lg:flex'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
