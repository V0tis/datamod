'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAnalysisTasks } from '@/lib/hooks/use-analysis-tasks'
import type { AnalysisTask } from '@/lib/analysis-types'
import { RefreshCcw, Ban, Loader2, CheckCircle2, AlertCircle, ChevronRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

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

function formatStarted(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function TasksPage() {
  const router = useRouter()
  const { tasks, runningCount, setActiveJob, retryTask, cancelTask, refresh } = useAnalysisTasks()
  const [deleteTarget, setDeleteTarget] = useState<AnalysisTask | null>(null)
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const goToTaskResults = (task: AnalysisTask) => {
    void setActiveJob(task.id)
    router.push(`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`)
  }

  const handleDeleteTask = useCallback(async (task: AnalysisTask) => {
    setDeletingId(task.id)
    try {
      const res = await fetch(`/api/research/jobs/${task.id}`, { method: 'DELETE' })
      if (res.status === 204) {
        await refresh()
        setDeleteTarget(null)
        toast.success('삭제되었습니다.')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? '삭제에 실패했습니다.')
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }, [refresh])

  const handleDeleteAll = useCallback(async () => {
    setClearingAll(true)
    try {
      const res = await fetch('/api/research/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      })
      if (res.status === 204) {
        await refresh()
        setClearAllOpen(false)
        toast.success('모든 분석 기록이 삭제되었습니다.')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? '삭제에 실패했습니다.')
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setClearingAll(false)
    }
  }, [refresh])

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto min-h-screen bg-background">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-foreground tracking-tight">분석 작업</h1>
          <p className="text-muted-foreground text-xs mt-0.5">
          {runningCount > 0
            ? `${runningCount}건 진행 중`
            : tasks.length === 0
              ? '아직 분석이 없습니다. 대시보드에서 새 분석을 시작하세요.'
              : `${tasks.length}건`}
          </p>
        </div>
        {tasks.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-destructive border-destructive/50 hover:bg-destructive/10"
            onClick={() => setClearAllOpen(true)}
          >
            Delete All Tasks
          </Button>
        )}
      </header>

      {/* Single delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-task-title"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !deletingId && setDeleteTarget(null)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-5">
            <h2 id="delete-task-title" className="font-semibold text-foreground mb-2">
              분석 기록 삭제
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              이 분석 기록을 삭제하시겠습니까?
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!!deletingId}
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!!deletingId}
                onClick={() => handleDeleteTask(deleteTarget)}
              >
                {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete all confirmation modal */}
      {clearAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-all-title"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !clearingAll && setClearAllOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-5">
            <h2 id="delete-all-title" className="font-semibold text-foreground mb-2">
              모든 분석 기록 삭제
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              모든 분석 기록을 삭제하시겠습니까? 삭제된 기록은 복구할 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!!clearingAll}
                onClick={() => setClearAllOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!!clearingAll}
                onClick={handleDeleteAll}
              >
                {clearingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card/50 py-12 px-6 text-center">
          <p className="text-sm text-muted-foreground">아직 분석 작업이 없습니다.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-primary hover:underline"
          >
            시장 분석 시작
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
                  {task.createdAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      시작: {formatStarted(task.createdAt)}
                    </p>
                  )}
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
                      aria-label="재시도"
                    >
                      <RefreshCcw className="h-4 w-4" />
                    </button>
                  )}
                  {isTaskActive(task) && (
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                      onClick={() => void cancelTask(task.id)}
                      aria-label="취소"
                    >
                      <Ban className="h-4 w-4" />
                    </button>
                  )}
                  <Link
                    href={`/results?keyword=${encodeURIComponent(task.keyword)}&country=${encodeURIComponent(task.countryCode || 'KR')}`}
                    onClick={() => void setActiveJob(task.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="보기"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget(task)
                    }}
                    disabled={!!deletingId}
                    aria-label="삭제"
                  >
                    {deletingId === task.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
