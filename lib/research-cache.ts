/**
 * Research cache: key strategy, TTL, and request metadata logging.
 * When cache is valid we skip AI calls (cost savings); when expired we allow new calls.
 *
 * CACHE OWNERSHIP
 * - Storage: Supabase table `research_history`. One row per (user_id, keyword, country_code).
 * - Writers: stream route (initial report + key_metrics), insights/tab route (analysis_groq, analysis_gemini, analysis_results).
 * - Readers: insights/tab route (read-through), history route (GET), research-store (loadFromHistory).
 *
 * CACHE KEY STRUCTURE (standardized)
 * - Primary key: (user_id, keyword, country_code). DB unique constraint on these columns.
 * - Region: country_code (e.g. KR, US). Normalized to non-empty string; default 'KR'.
 * - Model: not part of the key. One row holds both Groq and Gemini outputs per tab (logic/creative/fact).
 * - Time bucket: we do not bucket by hour/day; validity is "updated_at within TTL". So effectively one cache entry per (user, keyword, region) until TTL expires.
 *
 * COST DECISIONS
 * - TTL 24h: Same (user, keyword, country) reuses cached Groq/Gemini/Consensus for 24h, minimizing redundant AI calls.
 * - Predictable cost: At most one full tab analysis (Groq + Gemini + Consensus) per key per 24h unless user forces reanalyze.
 * - Reanalyze (Consensus only): Reuses stored analysis_groq/analysis_gemini; only calls Gemini for synthesizeConsensus (one cheaper call).
 */

/** Cost: 24h TTL per (user, keyword, country) reuses Groq/Gemini/Consensus and avoids repeated paid calls for the same scope. */
export const RESEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Same TTL in hours for logging and docs. */
export const RESEARCH_CACHE_TTL_HOURS = 24

/** Logical scope for logging; DB key is always (user_id, keyword, country_code). */
export type ResearchCacheScope = 'insight_tab' | 'stream_report' | 'run_research'

/**
 * Standardized cache key parts. Matches DB columns (user_id, keyword, country_code).
 * Use for lookups and logging; single source of truth for "what identifies one cache entry".
 */
export type CacheKeyParts = {
  userId: string
  keyword: string
  countryCode: string
}

/**
 * Build the logical cache key parts used for DB lookups and logging.
 * Normalizes keyword (trim) and countryCode (default 'KR').
 */
export function buildCacheKeyParts(userId: string, keyword: string, countryCode: string): CacheKeyParts {
  return {
    userId,
    keyword: keyword.trim(),
    countryCode: (countryCode || 'KR').trim() || 'KR',
  }
}

/**
 * True if updatedAt is within ttlMs from now.
 * Cost: returning false allows new AI calls; explicit TTL keeps behavior predictable.
 */
export function isCacheValid(
  updatedAt: string | null | undefined,
  ttlMs: number = RESEARCH_CACHE_TTL_MS
): boolean {
  if (!updatedAt) return false
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return false
  return Date.now() - t <= ttlMs
}

/** Age in ms since updatedAt; negative if updatedAt is in the future. */
export function cacheAgeMs(updatedAt: string | null | undefined): number | null {
  if (!updatedAt) return null
  const t = new Date(updatedAt).getTime()
  if (Number.isNaN(t)) return null
  return Date.now() - t
}

export type CacheLogMeta = {
  scope: ResearchCacheScope
  keyword: string
  countryCode: string
  /** insight_tab: which tab (logic/creative/fact) */
  tab?: string
  /** Where the result came from: 'keyword' | 'report_id' */
  source?: string
  /** Short reason: 'full' | 'consensus_only' | 'groq' | 'gemini' | 'groq_and_gemini' | 'expired' | 'write' | 'ttl_exceeded' */
  detail?: string
  /** When we skip AI calls (cache hit or reanalyze using stored analyses). */
  skippedAi?: boolean
  /** updated_at from row, for cost attribution. */
  updatedAt?: string
}

/**
 * Lightweight request metadata log: one line per event, no payloads.
 * Use for cost attribution (cache hit vs miss) and debugging duplicate calls.
 */
export function logCacheEvent(event: 'hit' | 'miss' | 'expired' | 'write' | 'run_research', meta: CacheLogMeta): void {
  const { scope, keyword, countryCode, tab, source, detail, skippedAi, updatedAt } = meta
  const parts = [
    '[ResearchCache]',
    event,
    scope,
    `k=${keyword.slice(0, 32)}`,
    `c=${countryCode}`,
  ]
  if (tab) parts.push(`tab=${tab}`)
  if (source) parts.push(`src=${source}`)
  if (detail) parts.push(detail)
  if (skippedAi === true) parts.push('skipped_ai')
  if (updatedAt) parts.push(`at=${updatedAt}`)
  console.log(parts.join(' '))
}
