/**
 * Analysis task model: first-class entity for a single keyword analysis.
 * Authoritative status from backend (research_history.analysis_status or job status).
 * UI renders ONLY from status; no boolean inference (isLoading, hasResult, etc).
 * One-directional: queued → analyzing → completed | failed
 */
export type AnalysisStatus = 'queued' | 'analyzing' | 'completed' | 'failed'

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
