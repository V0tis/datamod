'use client'

import { useEffect, useRef } from 'react'

export type AnalysisTaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export type AnalysisTask = {
  step_name: string
  status: AnalysisTaskStatus
  output_data: unknown
  error_message: string | null
  started_at: string | null
  completed_at: string | null
}

export type AnalysisTasksResponse = {
  analysis_id: string
  tasks: AnalysisTask[]
  all_completed: boolean
  any_failed: boolean
  running_step: string | null
}

const POLL_INTERVAL_MS = 2000

export function useAnalysisTasksPoll(
  analysisId: string | null,
  isAnalyzing: boolean,
  onTasks: (data: AnalysisTasksResponse) => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!analysisId || !isAnalyzing) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/research/tasks?analysis_id=${encodeURIComponent(analysisId)}`)
        if (!res.ok) return
        const data = (await res.json()) as AnalysisTasksResponse
        onTasks(data)
      } catch {
        /* ignore */
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [analysisId, isAnalyzing, onTasks])
}
