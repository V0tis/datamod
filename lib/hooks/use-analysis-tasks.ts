'use client'

import { useMemo } from 'react'
import { useResearchStore, getTasksFromStore } from '@/lib/stores/research-store'
import type { AnalysisTask } from '@/lib/analysis-types'

/**
 * Global analysis state and actions. Use this instead of the store directly
 * so components stay decoupled from store shape and naming (jobs → tasks).
 */
export function useAnalysisTasks() {
  const jobs = useResearchStore((s) => s.jobs)
  const jobOrder = useResearchStore((s) => s.jobOrder)
  const refreshJobs = useResearchStore((s) => s.refreshJobs)
  const startResearch = useResearchStore((s) => s.startResearch)
  const setActiveJob = useResearchStore((s) => s.setActiveJob)
  const retryJob = useResearchStore((s) => s.retryJob)
  const cancelJob = useResearchStore((s) => s.cancelJob)

  const tasks: AnalysisTask[] = useMemo(() => getTasksFromStore(), [jobs, jobOrder])
  const runningCount = useMemo(
    () => tasks.filter((t) => t.status === 'idle' || t.status === 'analyzing').length,
    [tasks]
  )

  return {
    tasks,
    runningCount,
    refresh: refreshJobs,
    startAnalysis: startResearch,
    setActiveJob,
    retryTask: retryJob,
    cancelTask: cancelJob,
  }
}
