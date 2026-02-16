'use client'

import { useMemo, useEffect } from 'react'
import { useResearchStore, getTasksFromStore } from '@/lib/stores/research-store'
import type { AnalysisTask } from '@/lib/analysis-types'

/**
 * Returns the analysis task for the given keyword (if any) and syncs store
 * selection. Use on the results page to drive UI from global task state.
 * Sync/realtime is handled by AnalysisJobSync in the app shell.
 */
export function useCurrentTask(keyword: string | null, countryCode?: string): AnalysisTask | null {
  const jobs = useResearchStore((s) => s.jobs)
  const jobOrder = useResearchStore((s) => s.jobOrder)
  const setActiveJobByKeyword = useResearchStore((s) => s.setActiveJobByKeyword)

  const tasks = useMemo(() => getTasksFromStore(), [jobs, jobOrder])
  const k = (keyword ?? '').trim()
  const country = (countryCode ?? 'KR').trim() || 'KR'

  const task = useMemo(() => {
    if (!k) return null
    return tasks.find((t) => t.keyword === k && (t.countryCode ?? 'KR') === country) ?? null
  }, [tasks, k, country])

  useEffect(() => {
    if (k) void setActiveJobByKeyword(k)
  }, [k, setActiveJobByKeyword])

  return task
}
