'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import { Home, History, Bookmark, LogOut, Settings, ChevronDown, RefreshCcw, Ban, Loader2, CheckCircle2, AlertCircle, LayoutList, BookOpen } from 'lucide-react'
import { ThemeSwitcher } from '@/components/theme-switcher'
import { RinLogo } from '@/components/rin-logo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { showErrorToast } from '@/lib/error-toast'
import { useAnalysisTasks } from '@/lib/hooks/use-analysis-tasks'
import { useReadingModeStore } from '@/lib/stores/reading-mode-store'
import type { AnalysisTask } from '@/lib/analysis-types'

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/history', label: 'History', icon: History },
  { href: '/insights', label: 'Insights', icon: Bookmark },
]

const TASK_STATUS_LABEL: Record<AnalysisTask['status'], string> = {
  idle: 'Pending',
  analyzing: 'Analyzing',
  completed: 'Completed',
  failed: 'Failed',
}

/** Maps progress text to a high-level stage for at-a-glance PM UX. */
function getStageLabel(task: AnalysisTask): string {
  if (task.status === 'completed') return 'Completed'
  if (task.status === 'failed') return 'Error'
  const p = (task.progress ?? '').toLowerCase()
  // Collecting: news fetch
  if (p.includes('뉴스') || p.includes('news')) return 'Collecting'
  // Analyzing: AI / insight generation
  if (p.includes('ai') || p.includes('분석') || p.includes('인사이트')) return 'Analyzing'
  // Finalizing: parse, report, done
  if (p.includes('정리') || p.includes('저장') || p.includes('완료') || p.includes('캐시')) return 'Finalizing'
  return task.status === 'analyzing' ? 'Analyzing' : 'Pending'
}

function isTaskActive(t: AnalysisTask) {
  return t.status === 'idle' || t.status === 'analyzing'
}

export function GlobalHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const { tasks, runningCount, setActiveJob, retryTask, cancelTask } = useAnalysisTasks()
  const hasTasks = tasks.length > 0
  const tasksForStrip = hasTasks ? tasks.slice(0, 6) : []
  const readingMode = useReadingModeStore((s) => s.mode)
  const setReadingMode = useReadingModeStore((s) => s.setMode)

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

  // Navigate to results for a task and set it active; used by chip and dropdown link
  const goToTaskResults = (task: AnalysisTask) => {
    void setActiveJob(task.id)
    setAnalysisOpen(false)
    router.push(`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`)
  }

  return (
    <>
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

        {/* Global analysis indicator: shows count when running; opens dropdown with full task list */}
        <div className="relative shrink-0" ref={panelRef}>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1.5 text-sm',
              runningCount > 0 && 'text-warning'
            )}
            onClick={() => setAnalysisOpen((o) => !o)}
            aria-expanded={analysisOpen}
            aria-haspopup="true"
            aria-label={runningCount > 0 ? `${runningCount} analysis tasks in progress` : 'View analysis tasks'}
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
                            <button
                              type="button"
                              onClick={() => goToTaskResults(task)}
                              className="font-medium text-foreground hover:text-primary truncate block text-left w-full"
                            >
                              {task.keyword}
                            </button>
                            {/* Stage/progress line: show high-level stage for PM at-a-glance */}
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {task.progress ?? getStageLabel(task)}
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
                                  ? 'bg-destructive/10 text-destructive'
                                  : task.status === 'completed'
                                    ? 'bg-success/10 text-success'
                                    : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {TASK_STATUS_LABEL[task.status]}
                            </span>
                            {task.status === 'failed' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); void retryTask(task.id) }} aria-label="Retry">
                                <RefreshCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {isTaskActive(task) && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); void cancelTask(task.id) }} aria-label="Cancel">
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

        {/* Reading density: compact = scan, focus = deep read; persists across navigation */}
        <div className="hidden sm:flex items-center rounded-lg border border-border bg-muted/30 p-0.5" role="group" aria-label="Reading density">
          <button
            type="button"
            onClick={() => setReadingMode('compact')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              readingMode === 'compact' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Compact — more content per screen"
            aria-pressed={readingMode === 'compact'}
          >
            <LayoutList className="h-3.5 w-3.5" aria-hidden />
            <span>Compact</span>
          </button>
          <button
            type="button"
            onClick={() => setReadingMode('focus')}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
              readingMode === 'focus' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
            title="Focus — comfortable long-form reading"
            aria-pressed={readingMode === 'focus'}
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden />
            <span>Focus</span>
          </button>
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

      {/* Persistent activity strip: visible across all pages when any task exists; each keyword as a chip with stage */}
      {hasTasks && (
        <div
          className="sticky top-14 z-20 flex items-center gap-2 border-b border-border bg-card/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80"
          role="status"
          aria-live="polite"
          aria-label="Background analysis tasks"
        >
          <span className="text-xs font-medium text-muted-foreground shrink-0 hidden sm:inline">
            Background analyses
          </span>
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
            {tasksForStrip.map((task) => {
              const stage = getStageLabel(task)
              const isActive = isTaskActive(task)
              return (
                <Link
                  key={task.id}
                  href={`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`}
                  onClick={(e) => {
                    e.preventDefault()
                    goToTaskResults(task)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-90',
                    task.status === 'failed' && 'border-destructive/40 bg-destructive/5 text-destructive',
                    task.status === 'completed' && 'border-success/30 bg-success/5 text-success',
                    isActive && 'border-primary/40 bg-primary/5 text-foreground'
                  )}
                  title={`${task.keyword}: ${task.progress ?? stage}`}
                >
                  {isActive && <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />}
                  {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden />}
                  {task.status === 'failed' && <AlertCircle className="h-3 w-3 shrink-0" aria-hidden />}
                  <span className="truncate max-w-[120px]">{task.keyword}</span>
                  <span className="text-muted-foreground shrink-0">·</span>
                  <span className="shrink-0">{stage}</span>
                </Link>
              )
            })}
            {tasks.length > tasksForStrip.length && (
              <button
                type="button"
                onClick={() => setAnalysisOpen(true)}
                className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                +{tasks.length - tasksForStrip.length} more
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
