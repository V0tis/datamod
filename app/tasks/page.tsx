'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAnalysisTasks } from '@/lib/hooks/use-analysis-tasks'
import type { AnalysisTask } from '@/lib/analysis-types'
import { RefreshCcw, Ban, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const TASK_STATUS_LABEL: Record<AnalysisTask['status'], string> = {
  queued: '대기중',
  analyzing: '분석중',
  completed: '분석완료',
  failed: '분석실패',
}

function getStatusColor(status: AnalysisTask['status']): string {
  switch (status) {
    case 'failed':
      return 'bg-destructive/10 text-destructive'
    case 'completed':
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
    case 'analyzing':
    case 'queued':
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function isTaskActive(t: AnalysisTask) {
  return t.status === 'queued' || t.status === 'analyzing'
}

export default function TasksPage() {
  const router = useRouter()
  const { tasks, runningCount, setActiveJob, retryTask, cancelTask } = useAnalysisTasks()

  const goToTaskResults = (task: AnalysisTask) => {
    void setActiveJob(task.id)
    router.push(`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`)
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto min-h-screen bg-background">
      <header className="mb-6">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">Analysis Tasks</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          {runningCount > 0
            ? `${runningCount} task(s) in progress`
            : tasks.length === 0
              ? 'No analyses yet. Start one from Dashboard.'
              : `${tasks.length} task(s)`}
        </p>
      </header>

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/50 py-12 px-6 text-center">
          <p className="text-sm text-muted-foreground">No analysis tasks yet.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline"
          >
            Start Analysis
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <li
              key={task.id}
              className={cn(
                'rounded-lg border border-border/60 bg-card p-4 transition-colors hover:border-primary/30',
                isTaskActive(task) && 'border-primary/20 bg-primary/5'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => goToTaskResults(task)}
                    className="text-left font-medium text-foreground hover:text-primary truncate block w-full"
                  >
                    {task.keyword}
                  </button>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
                        getStatusColor(task.status)
                      )}
                    >
                      {isTaskActive(task) && <Loader2 className="h-3 w-3 animate-spin" />}
                      {task.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                      {task.status === 'failed' && <AlertCircle className="h-3 w-3" />}
                      {TASK_STATUS_LABEL[task.status]}
                    </span>
                    {task.progress && (
                      <span className="text-xs text-muted-foreground truncate">{task.progress}</span>
                    )}
                  </div>
                  {task.error && (
                    <p className="mt-2 text-xs text-destructive line-clamp-2">{task.error}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {task.status === 'failed' && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => void retryTask(task.id)}
                      aria-label="Retry"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  )}
                  {isTaskActive(task) && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => void cancelTask(task.id)}
                      aria-label="Cancel"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                  <Link
                    href={`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`}
                    onClick={() => void setActiveJob(task.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="View"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
