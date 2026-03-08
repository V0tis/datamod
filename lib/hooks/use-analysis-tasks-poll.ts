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

const POLL_INTERVAL_MS = 1500
/** Stop polling after 15 min even if client never received done/error (prevents infinite polling) */
const MAX_POLL_DURATION_MS = 15 * 60 * 1000

export function useAnalysisTasksPoll(
  analysisId: string | null,
  isAnalyzing: boolean,
  onTasks: (data: AnalysisTasksResponse) => void
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    startTimeRef.current = null
  }

  useEffect(() => {
    if (!analysisId || !isAnalyzing) {
      stopPolling()
      return
    }

    startTimeRef.current = Date.now()

    const poll = async () => {
      try {
        if (startTimeRef.current && Date.now() - startTimeRef.current > MAX_POLL_DURATION_MS) {
          stopPolling()
          return
        }
        const res = await fetch(`/api/research/tasks?analysis_id=${encodeURIComponent(analysisId)}`)
        if (!res.ok) return
        const data = (await res.json()) as AnalysisTasksResponse
        onTasks(data)
        if (data.all_completed || data.any_failed) {
          stopPolling()
        }
      } catch {
        /* ignore */
      }
    }

    poll()
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return stopPolling
  }, [analysisId, isAnalyzing, onTasks])
}
