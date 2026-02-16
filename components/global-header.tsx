'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, LogOut, Settings, ChevronDown, RefreshCcw, Ban, Loader2 } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { RinLogo } from '@/components/rin-logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { showErrorToast } from '@/lib/error-toast'
import { useAnalysisTasks } from '@/lib/hooks/use-analysis-tasks'
import type { AnalysisTask } from '@/lib/analysis-types'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/history', label: 'History', icon: History },
]

const TASK_STATUS_LABEL: Record<AnalysisTask['status'], string> = {
  idle: 'Pending',
  analyzing: 'Analyzing',
  completed: 'Completed',
  failed: 'Failed',
}

function isTaskActive(t: AnalysisTask) {
  return t.status === 'idle' || t.status === 'analyzing'
}

export function GlobalHeader() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { tasks, runningCount, setActiveJob, retryTask, cancelTask } = useAnalysisTasks()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user: u } }) => setUser(u ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    )
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
        showErrorToast(err, { fallbackMessage: 'Failed to load profile' })
        setDisplayName(user.email ?? '')
      })
  }, [user])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAnalysisOpen(false)
      }
    }
    if (analysisOpen) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [analysisOpen])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href="/" className="flex items-center gap-2 shrink-0 hover:opacity-90">
        <RinLogo size={24} className="shrink-0" />
        <span className="font-semibold text-foreground hidden sm:inline">Rin</span>
      </Link>

      <nav className="flex items-center gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActiveRoute = pathname === href || (href !== '/' && pathname?.startsWith(href))
          return (
            <Link key={href} href={href}>
              <Button
                variant={isActiveRoute ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          )
        })}
      </nav>

      <div className="flex-1 min-w-0" />

      {/* Lightweight global indicator: pill when running, dropdown for full list */}
      <div className="relative shrink-0" ref={panelRef}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-1.5 text-sm',
            runningCount > 0 && 'text-amber-600 dark:text-amber-400'
          )}
          onClick={() => setAnalysisOpen((o) => !o)}
          aria-expanded={analysisOpen}
          aria-haspopup="true"
        >
          {runningCount > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          <span>
            {runningCount > 0 ? `${runningCount} analyzing` : 'Analyses'}
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', analysisOpen && 'rotate-180')} />
        </Button>
        {analysisOpen && (
          <div className="absolute right-0 top-full mt-1 w-[300px] max-w-[90vw] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-xs font-medium text-muted-foreground">
              Analysis tasks
            </div>
            <div className="max-h-[320px] overflow-auto">
              {tasks.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No analyses yet. Start one from Home.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {tasks.slice(0, 8).map((task) => (
                    <li key={task.id} className="px-4 py-2.5 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`}
                            onClick={() => {
                              void setActiveJob(task.id)
                              setAnalysisOpen(false)
                            }}
                            className="font-medium text-foreground hover:text-primary truncate block"
                          >
                            {task.keyword}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {task.progress ?? 'Waiting'}
                          </p>
                          {task.error && (
                            <p className="text-xs text-destructive line-clamp-2 mt-1">{task.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px]',
                              task.status === 'failed'
                                ? 'bg-red-500/10 text-red-500'
                                : task.status === 'completed'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {TASK_STATUS_LABEL[task.status]}
                          </span>
                          {task.status === 'failed' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void retryTask(task.id)} aria-label="Retry">
                              <RefreshCcw className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {isTaskActive(task) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void cancelTask(task.id)} aria-label="Cancel">
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      <ThemeSwitcher className="shrink-0" />
      <Link href="/settings">
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </Link>
      {user ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground truncate max-w-[120px]" title={user.email ?? ''}>
            {displayName || user.email || 'User'}
          </span>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </header>
  )
}
