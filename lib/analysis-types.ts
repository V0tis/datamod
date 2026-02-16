/**
 * Analysis task model: first-class entity for a single keyword analysis.
 * Backing store and API use analysis_jobs; this type is the public contract for UI.
 */
export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AnalysisTask {
  id: string
  keyword: string
  status: AnalysisStatus
  /** Human-readable progress step (e.g. "뉴스 수집", "AI 분석") */
  progress?: string | null
  /** Populated when status is completed; from research_history / reports */
  result?: unknown | null
  /** ISO date string */
  createdAt: string
  /** Country code for the analysis scope */
  countryCode?: string
  /** Error message when status is failed */
  error?: string | null
}

/** Map API job status to AnalysisTask status */
export function jobStatusToTaskStatus(
  status: string
): AnalysisStatus {
  switch (status) {
    case 'queued':
      return 'pending'
    case 'running':
      return 'running'
    case 'succeeded':
      return 'completed'
    case 'failed':
    case 'cancelled':
      return 'failed'
    default:
      return 'pending'
  }
}
