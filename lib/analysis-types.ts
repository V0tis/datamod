/**
 * Analysis task model: first-class entity for a single keyword analysis.
 * Backing store and API use analysis_jobs; this type is the public contract for UI.
 * Status aligns with product: idle → analyzing → completed | failed.
 */
export type AnalysisStatus = 'idle' | 'analyzing' | 'completed' | 'failed'

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

/** Map API job status to AnalysisTask status. */
export function jobStatusToTaskStatus(status: string): AnalysisStatus {
  switch (status) {
    case 'queued':
      return 'idle'
    case 'running':
      return 'analyzing'
    case 'succeeded':
      return 'completed'
    case 'failed':
    case 'cancelled':
      return 'failed'
    default:
      return 'idle'
  }
}
