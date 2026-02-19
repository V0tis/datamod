/**
 * Types for PM saved insights (knowledge layer).
 * Snapshot is a structured copy of analysis at save time; no link to live analysis generation.
 */

/** Stored quality score; label is string for JSON/DB compatibility. */
export interface InsightQualityScore {
  score: number
  label: string
  explanation: string
}

export interface InsightSnapshot {
  keyword: string
  countryCode?: string
  summary?: string
  strategicSummary?: {
    summary?: string
    actionItems?: string[]
    opportunity?: string
    threat?: string
  }
  reportId?: string | null
  savedAt: string
  /** Trustworthiness score (0–100) at save time; not factual correctness. */
  qualityScore?: InsightQualityScore
}

export interface SavedInsight {
  id: string
  name: string
  note: string | null
  snapshot: InsightSnapshot
  created_at: string
}
