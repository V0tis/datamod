'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard,
  History,
  BookmarkCheck,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'
import { motionConfig } from '@/lib/motion-config'
import { useLogout } from '@/components/providers/logout-provider'

const ICON_NAV = 20

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard, tooltip: '키워드 검색 및 새 분석 시작' },
  { href: '/history', label: '분석 기록', icon: History, tooltip: '과거 리서치 결과 관리 및 조회' },
  { href: '/insights', label: '저장한 인사이트', icon: BookmarkCheck, tooltip: '북마크한 인사이트 모아보기' },
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
    <div className="flex h-full w-full flex-col bg-[#111827] text-gray-300">
      <div className="shrink-0 border-b border-white/10 px-6 py-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-white transition-opacity hover:opacity-90"
          aria-label="rin-ai 홈(대시보드)으로 이동"
        >
          <RinLogo className="h-8 w-8 shrink-0 text-white" />
          <span className="text-sm font-semibold tracking-tight">rin-ai</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="메인 메뉴">
        <ul className="space-y-0.5" role="list">
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <li key={item.href + item.label} className="relative">
                <motion.span
                  aria-hidden
                  initial={false}
                  animate={{ opacity: active ? 1 : 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-r-full bg-sky-600"
                />
                <Link href={item.href} title={item.tooltip} className="block">
                  <motion.span
                    layout={false}
                    whileHover={{
                      x: motionConfig.navHover.x,
                      transition: motionConfig.navHover.transition,
                    }}
                    className={cn(
                      'relative flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                      'border-l-2 border-transparent pl-[11px]',
                      active
                        ? 'border-sky-600 bg-white/10 text-sky-600'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                    )}
                  >
                    <Icon
                      size={ICON_NAV}
                      className="shrink-0 transition-colors duration-200"
                      aria-hidden
                    />
                    {item.label}
                  </motion.span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="shrink-0 space-y-3 border-t border-white/10 px-3 py-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-500">테마</span>
          <ThemeSwitcher />
        </div>
        {user ? (
          <div className="space-y-1">
            <p className="truncate px-3 py-1.5 text-xs text-gray-500" title={user.email ?? ''}>
              {user.email ?? 'User'}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              title="로그아웃"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut size={ICON_NAV} className="shrink-0 opacity-90" aria-hidden />
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            title="로그인"
            className={cn(
              'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              'text-slate-400 hover:bg-white/5 hover:text-slate-200'
            )}
          >
            <LogOut size={ICON_NAV} className="shrink-0 opacity-90" aria-hidden />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  const topbarContent = (
    <div className="flex min-h-[3.5rem] w-full flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-white px-3 py-2 sm:gap-4 sm:px-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-2 sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
          aria-label="rin-ai 홈(대시보드)으로 이동"
        >
          <RinLogo className="h-8 w-8 shrink-0 text-neutral-900 dark:text-zinc-100" />
          <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-zinc-100">rin-ai</span>
        </Link>
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:flex-initial" aria-label="메인 메뉴">
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
                    ? 'bg-slate-100 text-sky-600 dark:bg-zinc-800 dark:text-sky-400'
                    : 'text-slate-400 hover:bg-slate-50 hover:text-slate-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                <Icon
                  size={ICON_NAV}
                  className={cn('shrink-0 transition-colors duration-200', active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400')}
                  aria-hidden
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:gap-3">
        <ThemeSwitcher />
        {user ? (
          <>
            <span className="max-w-[140px] truncate text-xs text-slate-500 dark:text-zinc-400" title={user.email ?? ''}>
              {user.email ?? 'User'}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              title="로그아웃"
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
                'text-slate-600 hover:bg-slate-100 hover:text-neutral-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut size={ICON_NAV} className="shrink-0 text-slate-400" aria-hidden />
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/login"
            title="로그인"
            className={cn(
              'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
              'text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
            )}
          >
            <LogOut size={ICON_NAV} className="shrink-0 text-slate-400" aria-hidden />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  /** 768px~1023px: 아이콘만 고정 레일 (전체 사이드바 대신) */
  const sidebarIconRail = (
    <div className="flex h-full w-full flex-col items-center border-r border-white/10 bg-[#111827] pt-6 pb-3 text-gray-300">
      <Link
        href="/"
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10"
        title="대시보드"
        aria-label="rin-ai 홈(대시보드)으로 이동"
      >
        <RinLogo className="h-8 w-8 shrink-0 text-white" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-0 py-1" aria-label="메인 메뉴">
        {navItems.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          return (
            <Link
              key={item.href + '-rail'}
              href={item.href}
              title={item.tooltip}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg transition-colors',
                active
                  ? 'bg-white/10 text-sky-600'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )}
            >
              <Icon size={ICON_NAV} className="shrink-0" aria-hidden />
              <span className="sr-only">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="mt-auto flex flex-col items-center gap-2 border-t border-white/10 pt-3">
        <ThemeSwitcher className="border-white/10 bg-white/5 text-white" />
        {user ? (
          <button
            type="button"
            onClick={() => void logout()}
            disabled={isLoggingOut}
            title="로그아웃"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/5 hover:text-white',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            <LogOut size={ICON_NAV} className="shrink-0" aria-hidden />
            <span className="sr-only">로그아웃</span>
          </button>
        ) : (
          <Link
            href="/login"
            title="로그인"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-white/5 hover:text-white"
          >
            <LogOut size={ICON_NAV} className="shrink-0" aria-hidden />
            <span className="sr-only">로그인</span>
          </Link>
        )}
      </div>
    </div>
  )

  if (isResultsPage) {
    return (
      <header className="fixed left-0 right-0 top-0 z-40 min-h-14 shrink-0 border-b border-border bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {topbarContent}
      </header>
    )
  }

  return (
    <>
      {/* &lt;768px: 햄버거 + 풀 너비 드로어 */}
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-neutral-900 shadow-sm md:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-[220px] flex-col border-r border-white/10 shadow-xl md:hidden',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'flex translate-x-0' : 'hidden -translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      {/* 768px~1023px: 아이콘 레일 */}
      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen w-[4.5rem] flex-col md:flex lg:hidden"
        aria-label="축소 내비게이션"
      >
        {sidebarIconRail}
      </aside>

      {/* ≥1024px: 전체 사이드바 */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] flex-col border-r border-white/10 shadow-xl lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
