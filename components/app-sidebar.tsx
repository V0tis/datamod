'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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

const navItems = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/history', label: '분석 기록', icon: BarChart3 },
  { href: '/insights', label: '저장한 인사이트', icon: Bookmark },
  { href: '/settings', label: '설정', icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
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

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const active = isActive(item)
          const Icon = item.icon
          return (
            <Link
              key={item.href + item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'border-l-2 -ml-px pl-[11px]',
                active
                  ? 'border-primary bg-accent/50 text-foreground'
                  : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0 opacity-80" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer: theme + user + sign out */}
      <div className="shrink-0 border-t border-border/60 px-3 py-3 space-y-2">
        <div className="flex justify-between items-center px-2">
          <span className="text-xs text-muted-foreground">테마</span>
          <ThemeSwitcher />
        </div>
        {user ? (
          <div className="space-y-1">
            <p className="truncate px-3 py-1 text-xs text-muted-foreground" title={user.email ?? ''}>
              {user.email ?? 'User'}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-80" />
              로그아웃
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-80" />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  const topbarContent = (
    <div className="flex h-14 w-full items-center justify-between gap-2 sm:gap-4 px-3 sm:px-4 border-b border-border/60 bg-background">
      <div className="flex items-center gap-2 sm:gap-6 min-w-0 overflow-x-auto">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity shrink-0">
          <RinLogo size={22} className="shrink-0" />
          <span className="font-semibold text-foreground text-sm tracking-tight">rin-ai</span>
        </Link>
        <nav className="flex items-center gap-1 shrink-0">
          {navItems.map((item) => {
            const active = isActive(item)
            const Icon = item.icon
            return (
              <Link
                key={item.href + item.label}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent/50 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-80" />
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
              onClick={handleSignOut}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              )}
            >
              <LogOut className="h-4 w-4 shrink-0 opacity-80" />
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
              'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0 opacity-80" />
            로그인
          </Link>
        )}
      </div>
    </div>
  )

  if (isResultsPage) {
    return (
      <header className="fixed left-0 right-0 top-0 z-40 h-14 border-b border-border/60 bg-background">
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
          'fixed left-0 top-0 z-40 h-screen w-[220px] flex-col border-r border-border/60 bg-background',
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
