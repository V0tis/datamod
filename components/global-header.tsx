'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
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
import { useResearchStore, type AnalysisJob } from '@/lib/stores/research-store'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/history', label: 'History', icon: History },
]

const statusLabel: Record<string, string> = {
  queued: 'Pending',
  running: 'Running',
  succeeded: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const stepLabel: Record<string, string> = {
  news: 'Fetching news',
  gemini: 'AI analysis',
  creative: 'Insights',
  parse_json: 'Parsing',
  report_db: 'Saving',
  done: 'Done',
  cached: 'Cached',
}

function isActive(job: AnalysisJob) {
  return job.status === 'queued' || job.status === 'running'
}

export function GlobalHeader() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const jobs = useResearchStore((s) => s.jobs)
  const jobOrder = useResearchStore((s) => s.jobOrder)
  const setActiveJob = useResearchStore((s) => s.setActiveJob)
  const retryJob = useResearchStore((s) => s.retryJob)
  const cancelJob = useResearchStore((s) => s.cancelJob)

  const taskList = useMemo(
    () => jobOrder.map((id) => jobs[id]).filter(Boolean) as AnalysisJob[],
    [jobOrder, jobs]
  )
  const runningCount = useMemo(
    () => taskList.filter((j) => isActive(j)).length,
    [taskList]
  )

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

      {/* Global analysis indicator: running count + entry to task list */}
      <div className="relative shrink-0" ref={panelRef}>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2',
            runningCount > 0 && 'text-amber-500 dark:text-amber-400'
          )}
          onClick={() => setAnalysisOpen((o) => !o)}
          aria-expanded={analysisOpen}
          aria-haspopup="true"
        >
          {runningCount > 0 ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          <span className="text-sm">
            {runningCount > 0 ? `${runningCount} running` : 'Analyses'}
          </span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', analysisOpen && 'rotate-180')} />
        </Button>
        {analysisOpen && (
          <div className="absolute right-0 top-full mt-1 w-[320px] max-w-[90vw] rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
              Task status
            </div>
            <div className="max-h-[360px] overflow-auto">
              {taskList.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground text-center">
                  No analyses yet. Start one from Home.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {taskList.slice(0, 8).map((job) => (
                    <li key={job.id} className="px-4 py-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link
                            href={`/results?keyword=${encodeURIComponent(job.keyword)}&country=${encodeURIComponent(job.country_code || 'KR')}`}
                            onClick={() => {
                              void setActiveJob(job.id)
                              setAnalysisOpen(false)
                            }}
                            className="font-medium text-foreground hover:text-primary truncate block"
                          >
                            {job.keyword}
                          </Link>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {job.progress_step ? stepLabel[job.progress_step] ?? job.progress_step : 'Waiting'}
                          </p>
                          {job.error && (
                            <p className="text-xs text-destructive line-clamp-2 mt-1">{job.error}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px]',
                              job.status === 'failed'
                                ? 'bg-red-500/10 text-red-500'
                                : job.status === 'succeeded'
                                  ? 'bg-emerald-500/10 text-emerald-500'
                                  : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {statusLabel[job.status] ?? job.status}
                          </span>
                          {job.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => void retryJob(job.id)}
                              aria-label="Retry"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {isActive(job) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => void cancelJob(job.id)}
                              aria-label="Cancel"
                            >
                              <Ban className="h-4 w-4" />
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
