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
import { RinLogo } from '@/components/rin-logo'
import { DatamodWordmark } from '@/components/datamod-wordmark'
import { cn } from '@/lib/utils'
import { motionConfig } from '@/lib/motion-config'
import { useLogout } from '@/components/providers/logout-provider'
import { useResultsMainScrolledPast } from '@/hooks/use-results-main-scroll'

const ICON_NAV = 20

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard, tooltip: '오늘 시장 흐름과 핵심 지표를 확인' },
  { href: '/history', label: '분석 기록', icon: History, tooltip: '지난 분석 결과를 조회 및 관리' },
  { href: '/insights', label: '저장한 인사이트', icon: BookmarkCheck, tooltip: '북마크한 인사이트 모음' },
  { href: '/settings', label: '설정', icon: Settings, tooltip: 'API 키, 계정 및 환경설정 관리' },
]

const shellBorder = 'border-[#E5E8EF]'

export function AppSidebar() {
  const pathname = usePathname()
  const { logout, isLoggingOut } = useLogout()
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null))
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
  const hideResultsTopNav = useResultsMainScrolledPast(28)

  const sidebarContent = (
    <div className={cn('flex h-full w-full flex-col bg-white text-gray-700', shellBorder)}>
      <div className={cn('shrink-0 border-b px-6 py-6', shellBorder)}>
        <Link
          href="/"
          className="flex items-center gap-2 text-neutral-900 transition-opacity hover:opacity-90"
          aria-label="Datamod 홈으로 이동"
        >
          <RinLogo className="h-8 w-8 shrink-0 text-blue-600" />
          <DatamodWordmark className="text-sm" textClassName="text-neutral-900" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="주요 메뉴">
        <ul className="space-y-0.5" role="list">
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <li key={item.href + item.label}>
                <Link href={item.href} title={item.tooltip} className="block">
                  <motion.span
                    layout={false}
                    whileHover={{
                      x: motionConfig.navHover.x,
                      transition: motionConfig.navHover.transition,
                    }}
                    className={cn(
                      'relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                      active ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                    )}
                  >
                    {item.label}
                  </motion.span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className={cn('shrink-0 space-y-3 border-t px-3 py-4', shellBorder)}>
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
                'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50',
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
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LogOut size={ICON_NAV} className="shrink-0 opacity-90" aria-hidden />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  const topbarContent = (
    <div className={cn('flex min-h-[3.5rem] w-full items-center justify-between gap-2 border-b bg-white px-3 py-2 sm:gap-4 sm:px-4', shellBorder)}>
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-90"
          aria-label="Datamod 홈으로 이동"
        >
          <RinLogo className="h-8 w-8 shrink-0 text-blue-600" />
          <DatamodWordmark className="text-sm" textClassName="text-neutral-900" />
        </Link>
        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
          aria-label="주요 메뉴"
        >
          {navItems.map((item) => {
            const active = isActive(item)
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                title={item.tooltip}
                className={cn(
                  'flex shrink-0 items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-200 sm:px-3',
                  active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {user ? (
          <>
            <span
              className="hidden max-w-[min(10rem,28vw)] truncate text-xs text-gray-500 md:inline"
              title={user.email ?? ''}
            >
              {user.email ?? 'User'}
            </span>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={isLoggingOut}
              title="로그아웃"
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5',
                'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut size={ICON_NAV} className="shrink-0 text-gray-400" aria-hidden />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          </>
        ) : (
          <Link
            href="/login"
            title="로그인"
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5',
              'text-gray-600 hover:bg-gray-100'
            )}
          >
            <LogOut size={ICON_NAV} className="shrink-0 text-gray-400" aria-hidden />
            <span className="hidden sm:inline">로그인</span>
          </Link>
        )}
      </div>
    </div>
  )

  const sidebarIconRail = (
    <div className={cn('flex h-full w-full flex-col items-center border-r bg-white pt-6 pb-3 text-gray-700', shellBorder)}>
      <Link
        href="/"
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg text-blue-600 transition-colors hover:bg-gray-50"
        title="홈"
        aria-label="Datamod 홈으로 이동"
      >
        <RinLogo className="h-8 w-8 shrink-0 text-blue-600" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-0 py-1" aria-label="주요 메뉴">
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
                active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <Icon size={ICON_NAV} className="shrink-0" aria-hidden />
              <span className="sr-only">{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className={cn('mt-auto flex flex-col items-center gap-2 border-t pt-3', shellBorder)}>
        {user ? (
          <button
            type="button"
            onClick={() => void logout()}
            disabled={isLoggingOut}
            title="로그아웃"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900',
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
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
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
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-40 min-h-14 shrink-0 border-b border-[#E5E8EF] bg-white transition-transform duration-200 ease-out will-change-transform',
          hideResultsTopNav && '-translate-y-full pointer-events-none'
        )}
      >
        {topbarContent}
      </header>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="fixed left-4 top-4 z-50 flex h-9 w-9 items-center justify-center rounded-md border border-[#E5E8EF] bg-white text-neutral-900 shadow-sm md:hidden"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? '메뉴 닫기' : '메뉴 열기'}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-[220px] flex-col border-r border-[#E5E8EF] bg-white shadow-xl md:hidden',
          'transition-transform duration-200 ease-out',
          mobileOpen ? 'flex translate-x-0' : 'hidden -translate-x-full'
        )}
      >
        {sidebarContent}
      </aside>

      <aside
        className="fixed left-0 top-0 z-30 hidden h-screen w-[4.5rem] flex-col border-r border-[#E5E8EF] bg-white md:flex lg:hidden"
        aria-label="결과 페이지 빠른 메뉴"
      >
        {sidebarIconRail}
      </aside>

      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] flex-col border-r border-[#E5E8EF] bg-white shadow-sm lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
