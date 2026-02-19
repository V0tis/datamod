/**
 * Canonical analysis status. Single source of truth for UI.
 * UI renders ONLY from this; no heuristic inference (hasResult, isLoading, etc).
 * Transitions: queued → analyzing → completed | failed (never revert).
 */
export type AnalysisStatus = 'queued' | 'analyzing' | 'completed' | 'failed'

/** Display label for analysis_status */
export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  queued: '대기 중',
  analyzing: '분석 중',
  completed: '완료',
  failed: '실패',
}

export interface AnalysisTask {
  id: string
  keyword: string
  status: AnalysisStatus
  /** Human-readable progress (e.g. "Fetching news", "AI analysis"). */
  progress?: string | null
  /** Set when status is completed; from research_history / reports. */
  result?: unknown | null
  /** ISO date string; when the task was created. */
  createdAt: string
  /** When analysis actually started (created_at or first progress). */
  startedAt: string
  /** Set when status is completed or failed. */
  completedAt?: string | null
  countryCode?: string
  error?: string | null
}

/** Map API job status to AnalysisTask status. Backend is source of truth. */
export function jobStatusToTaskStatus(status: string): AnalysisStatus {
  switch (status) {
    case 'queued': return 'queued'
    case 'running': return 'analyzing'
    case 'succeeded': return 'completed'
    case 'failed':
    case 'cancelled': return 'failed'
    default: return 'queued'
  }
}
