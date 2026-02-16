'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCcw, Ban, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResearchStore, type AnalysisJob } from '@/lib/stores/research-store'

const statusLabel: Record<string, string> = {
  queued: '대기 중',
  running: '분석 중',
  succeeded: '완료',
  failed: '실패',
  cancelled: '취소됨',
}

const stepLabel: Record<string, string> = {
  news: '뉴스 수집',
  gemini: 'AI 분석',
  creative: '인사이트 생성',
  parse_json: '결과 정리',
  report_db: '리포트 저장',
  done: '완료',
  cached: '캐시 사용',
}

function isActive(job: AnalysisJob) {
  return job.status === 'queued' || job.status === 'running'
}

export function AnalysisJobCenter() {
  const [open, setOpen] = useState(true)
  const jobs = useResearchStore((s) => s.jobs)
  const jobOrder = useResearchStore((s) => s.jobOrder)
  const setActiveJob = useResearchStore((s) => s.setActiveJob)
  const retryJob = useResearchStore((s) => s.retryJob)
  const cancelJob = useResearchStore((s) => s.cancelJob)

  const list = useMemo(
    () => jobOrder.map((id) => jobs[id]).filter(Boolean),
    [jobOrder, jobs]
  )

  const activeCount = list.filter((job) => isActive(job)).length
  if (list.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[320px] max-w-[90vw]">
      <div className="rounded-xl border border-border bg-card shadow-lg">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-sm font-semibold"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="flex items-center gap-2">
            분석 작업
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              진행 {activeCount}
            </span>
          </span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {open && (
          <div className="max-h-[360px] overflow-auto border-t border-border">
            <ul className="divide-y divide-border">
              {list.slice(0, 6).map((job) => (
                <li key={job.id} className="px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/results?keyword=${encodeURIComponent(job.keyword)}&country=${encodeURIComponent(job.country_code || 'KR')}`}
                          onClick={() => void setActiveJob(job.id)}
                          className="truncate font-medium text-foreground hover:text-primary"
                        >
                          {job.keyword}
                        </Link>
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-xs',
                            job.status === 'failed'
                              ? 'bg-red-500/10 text-red-500'
                              : job.status === 'succeeded'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {statusLabel[job.status] ?? job.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {job.progress_step ? stepLabel[job.progress_step] ?? job.progress_step : '대기'}
                      </div>
                      {job.error && (
                        <div className="mt-1 text-xs text-red-500 line-clamp-2">
                          {job.error}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {job.status === 'failed' && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => void retryJob(job.id)}
                          aria-label="재시도"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </button>
                      )}
                      {isActive(job) && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                          onClick={() => void cancelJob(job.id)}
                          aria-label="취소"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
