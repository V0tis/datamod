'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { LogOut, History } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'

export function Header() {
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-foreground hover:opacity-90">
          <RinLogo size={28} />
          <span>Rin-AI</span>
        </Link>
        <nav className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/history">
                <Button variant="outline" size="sm" className="gap-1">
                  <History className="w-4 h-4" />
                  내 리서치 기록
                </Button>
              </Link>
              <span className="hidden sm:inline text-sm text-muted-foreground max-w-[180px] truncate">
                {user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-1"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </Button>
            </>
          ) : (
            <Link href="/auth/login">
              <Button variant="outline" size="sm">
                로그인
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}
