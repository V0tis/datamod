'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageTransition } from '@/components/common/PageTransition'
import { ErrorBoundary } from '@/components/error-boundary'
import { AppSidebar } from '@/components/app-sidebar'
import { AnalysisJobSync } from '@/components/research/analysis-job-sync'
import { useResearchStore } from '@/lib/stores/research-store'
import { useAnalysisTasks } from '@/lib/hooks/use-analysis-tasks'
import type { AnalysisTask } from '@/lib/analysis-types'
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const isAuthOnlyPath = (path: string) =>
  path === '/login' ||
  path.startsWith('/login/') ||
  path === '/auth/signup' ||
  path.startsWith('/auth/signup/') ||
  path === '/auth/verify' ||
  path.startsWith('/auth/verify/') ||
  path === '/auth/login' ||
  path.startsWith('/auth/login/') ||
  path === '/auth/callback' ||
  path.startsWith('/auth/callback/')

function getStageLabel(task: AnalysisTask): string {
  if (task.status === 'completed') return '분석완료'
  if (task.status === 'failed') return '분석실패'
  if (task.status === 'analyzing') return task.progress ?? '분석중'
  return '대기중'
}

function isTaskActive(t: AnalysisTask) {
  return t.status === 'queued' || t.status === 'analyzing'
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthPage = isAuthOnlyPath(pathname ?? '')
  const prevPathnameRef = useRef(pathname)
  const abortAnalysis = useResearchStore((s) => s.abortAnalysis)
  const isAnalyzingNow = useResearchStore((s) => s.isAnalyzingNow)
  const { tasks, runningCount, setActiveJob } = useAnalysisTasks()
  const hasTasks = tasks.length > 0
  const tasksForStrip = hasTasks ? tasks.slice(0, 6) : []
  const isResultsPage = pathname === '/results' || pathname?.startsWith('/results')

  const goToTaskResults = (task: AnalysisTask) => {
    void setActiveJob(task.id)
    router.push(`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`)
  }

  useEffect(() => {
    const prevPath = prevPathnameRef.current
    prevPathnameRef.current = pathname

    if (prevPath !== pathname) {
      const wasOnResults = prevPath?.startsWith('/results')
      const isLeavingResults = wasOnResults && !pathname?.startsWith('/results')

      if (isLeavingResults && isAnalyzingNow()) {
        abortAnalysis()
      }
    }
  }, [pathname, abortAnalysis, isAnalyzingNow])

  if (isAuthPage) {
    return (
      <main className="min-h-screen overflow-auto bg-background text-foreground">
        <ErrorBoundary>
          <PageTransition>{children}</PageTransition>
        </ErrorBoundary>
      </main>
    )
  }

  return (
    <>
      <AppSidebar />
      <div className="min-h-screen pt-14 lg:pt-0 lg:pl-[220px]">
        {hasTasks && isResultsPage && (
          <div
            className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            role="status"
            aria-live="polite"
          >
            <span className="text-xs font-medium text-muted-foreground shrink-0 hidden sm:inline">
              백그라운드 분석
            </span>
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              {tasksForStrip.map((task) => {
                const stage = getStageLabel(task)
                const active = isTaskActive(task)
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
                      task.status === 'completed' && 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400',
                      active && 'border-primary/40 bg-primary/5 text-foreground'
                    )}
                  >
                    {active && <Loader2 className="h-3 w-3 shrink-0 animate-spin" />}
                    {task.status === 'completed' && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                    {task.status === 'failed' && <AlertCircle className="h-3 w-3 shrink-0" />}
                    <span className="truncate max-w-[120px]">{task.keyword}</span>
                    <span className="text-muted-foreground shrink-0">·</span>
                    <span className="shrink-0">{stage}</span>
                  </Link>
                )
              })}
              {tasks.length > tasksForStrip.length && (
                <Link
                  href="/tasks"
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  +{tasks.length - tasksForStrip.length} more
                </Link>
              )}
            </div>
          </div>
        )}
        <main className="min-h-screen bg-background overflow-auto">
          <ErrorBoundary>
            <PageTransition>{children}</PageTransition>
          </ErrorBoundary>
        </main>
      </div>
      <AnalysisJobSync />
    </>
  )
}
