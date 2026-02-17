/**
 * Types for PM saved insights (knowledge layer).
 * Snapshot is a structured copy of analysis at save time; no link to live analysis generation.
 */

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
}

export interface SavedInsight {
  id: string
  name: string
  note: string | null
  snapshot: InsightSnapshot
  created_at: string
}
