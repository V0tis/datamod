/**
 * Central type exports – re-exports from lib for clean imports.
 * Use: import type { AnalysisMode, TrendItem } from '@/types'
 */
export * from '@/lib/types'
export type { AnalysisTask, AnalysisStatus } from '@/lib/analysis-types'
export type { TrendItem, TrendsResponse } from '@/lib/trends-types'
export type { SavedInsight, InsightSnapshot, InsightQualityScore } from '@/lib/insights-types'
