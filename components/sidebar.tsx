'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, LogOut, LogIn, Menu, X, TrendingUp } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/trends', label: '실시간 트렌드', icon: TrendingUp },
  { href: '/history', label: '내 리서치 기록', icon: History },
]

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)

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
