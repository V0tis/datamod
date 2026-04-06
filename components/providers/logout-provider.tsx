'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useResearchStore } from '@/lib/stores/research-store'

type LogoutContextValue = {
  /** Clears Supabase session, persisted research state, then hard-redirects to login (no intermediate broken UI). */
  logout: () => Promise<void>
  isLoggingOut: boolean
}

const LogoutContext = createContext<LogoutContextValue | null>(null)

export function LogoutProvider({ children }: { children: ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const inProgressRef = useRef(false)

  const logout = useCallback(async () => {
    if (inProgressRef.current) return
    inProgressRef.current = true
    setIsLoggingOut(true)

    try {
      const supabase = createClient()
      await supabase.auth.signOut({ scope: 'global' })
    } catch {
      // Continue: tokens may already be invalid; still clear client state and redirect
    }

    try {
      useResearchStore.persist.clearStorage()
    } catch {
      /* ignore */
    }
    try {
      useResearchStore.getState().reset()
    } catch {
      /* ignore */
    }

    window.location.replace('/login')
  }, [])

  const value = useMemo(() => ({ logout, isLoggingOut }), [logout, isLoggingOut])

  return (
    <LogoutContext.Provider value={value}>
      {children}
      {isLoggingOut ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-background text-foreground"
          role="alertdialog"
          aria-busy="true"
          aria-live="assertive"
          aria-label="로그아웃 처리 중"
        >
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">로그아웃 중입니다…</p>
        </div>
      ) : null}
    </LogoutContext.Provider>
  )
}

export function useLogout(): LogoutContextValue {
  const ctx = useContext(LogoutContext)
  if (!ctx) {
    throw new Error('useLogout must be used within LogoutProvider')
  }
  return ctx
}
