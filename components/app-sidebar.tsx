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
  { href: '/', label: '\uB300\uC2DC\uBCF4\uB4DC', icon: LayoutDashboard, tooltip: '\uC624\uB298 \uC2DC\uC7A5 \uD750\uB984\uACFC \uD575\uC2EC \uC9C0\uD45C\uB97C \uD655\uC778' },
  { href: '/history', label: '\uBD84\uC11D \uAE30\uB85D', icon: History, tooltip: '\uC9C0\uB09C \uBD84\uC11D \uACB0\uACFC\uB97C \uC870\uD68C \uBC0F \uAD00\uB9AC' },
  { href: '/insights', label: '\uC800\uC7A5\uD55C \uC778\uC0AC\uC774\uD2B8', icon: BookmarkCheck, tooltip: '\uBD81\uB9C8\uD06C\uD55C \uC778\uC0AC\uC774\uD2B8 \uBAA8\uC74C' },
  { href: '/settings', label: '\uC124\uC815', icon: Settings, tooltip: 'API \uD0A4, \uACC4\uC815 \uBC0F \uD658\uACBD\uC124\uC815 \uAD00\uB9AC' },
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
          aria-label="Datamod \uD648\uC73C\uB85C \uC774\uB3D9"
        >
          <RinLogo className="h-8 w-8 shrink-0 text-blue-600" />
          <DatamodWordmark className="text-sm" textClassName="text-neutral-900" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="\uC8FC\uC694 \uBA54\uB274">
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
              title="\uB85C\uADF8\uC544\uC6C3"
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut size={ICON_NAV} className="shrink-0 opacity-90" aria-hidden />
              \uB85C\uADF8\uC544\uC6C3
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            title="\uB85C\uADF8\uC778"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LogOut size={ICON_NAV} className="shrink-0 opacity-90" aria-hidden />
            \uB85C\uADF8\uC778
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
          aria-label="Datamod \uD648\uC73C\uB85C \uC774\uB3D9"
        >
          <RinLogo className="h-8 w-8 shrink-0 text-blue-600" />
          <DatamodWordmark className="text-sm" textClassName="text-neutral-900" />
        </Link>
        <nav
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-1 [&::-webkit-scrollbar]:hidden"
          aria-label="\uC8FC\uC694 \uBA54\uB274"
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
              title="\uB85C\uADF8\uC544\uC6C3"
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5',
                'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                'disabled:pointer-events-none disabled:opacity-50'
              )}
            >
              <LogOut size={ICON_NAV} className="shrink-0 text-gray-400" aria-hidden />
              <span className="hidden sm:inline">\uB85C\uADF8\uC544\uC6C3</span>
            </button>
          </>
        ) : (
          <Link
            href="/login"
            title="\uB85C\uADF8\uC778"
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors sm:px-2.5',
              'text-gray-600 hover:bg-gray-100'
            )}
          >
            <LogOut size={ICON_NAV} className="shrink-0 text-gray-400" aria-hidden />
            <span className="hidden sm:inline">\uB85C\uADF8\uC778</span>
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
        title="\uD648"
        aria-label="Datamod \uD648\uC73C\uB85C \uC774\uB3D9"
      >
        <RinLogo className="h-8 w-8 shrink-0 text-blue-600" />
      </Link>
      <nav className="flex flex-1 flex-col items-center gap-1 overflow-y-auto px-0 py-1" aria-label="\uC8FC\uC694 \uBA54\uB274">
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
            title="\uB85C\uADF8\uC544\uC6C3"
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-900',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            <LogOut size={ICON_NAV} className="shrink-0" aria-hidden />
            <span className="sr-only">\uB85C\uADF8\uC544\uC6C3</span>
          </button>
        ) : (
          <Link
            href="/login"
            title="\uB85C\uADF8\uC778"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut size={ICON_NAV} className="shrink-0" aria-hidden />
            <span className="sr-only">\uB85C\uADF8\uC778</span>
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
        aria-label={mobileOpen ? '\uBA54\uB274 \uB2EB\uAE30' : '\uBA54\uB274 \uC5F4\uAE30'}
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
        aria-label="\uACB0\uACFC \uD398\uC774\uC9C0 \uBE60\uB978 \uBA54\uB274"
      >
        {sidebarIconRail}
      </aside>

      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-[220px] flex-col border-r border-[#E5E8EF] bg-white shadow-sm lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
