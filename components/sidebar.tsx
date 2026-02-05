'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, LogOut, LogIn } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/', label: '홈', icon: Home },
  { href: '/history', label: '내 리서치 기록', icon: History },
]

export function Sidebar() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/auth/login'
  }

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r text-[var(--sidebar-fg)]"
      style={{
        backgroundColor: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
      }}
    >
      <Link
        href="/"
        className="flex h-14 items-center gap-2 border-b px-4 hover:opacity-90 transition-opacity"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        <RinLogo size={24} className="shrink-0 opacity-95" />
        <span className="font-semibold tracking-tight text-[var(--sidebar-fg)]">Rin-AI</span>
      </Link>
      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-fg)]'
                  : 'text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-fg)]'
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-80" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div
        className="border-t p-3"
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {user ? (
          <>
            <p className="mb-2 truncate px-3 text-xs text-[var(--sidebar-fg-muted)]" title={user.email ?? ''}>
              {user.email}
            </p>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-fg)]"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              로그아웃
            </button>
          </>
        ) : (
          <Link
            href="/auth/login"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--sidebar-fg-muted)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-fg)]"
          >
            <LogIn className="h-5 w-5 shrink-0" />
            로그인
          </Link>
        )}
      </div>
    </aside>
  )
}
