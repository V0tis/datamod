/**
 * Research cache: key strategy, TTL, and request metadata logging.
 * Used by insight tab and stream/history to reduce duplicate AI calls and keep cost predictable.
 *
 * Cache key strategy:
 * - Key dimensions: (user_id, keyword, country_code). One row per user+keyword+country; insight_tab and stream_report share it.
 * - Time range: entries are valid for RESEARCH_CACHE_TTL_MS; after that we treat as expired and allow new AI calls.
 * - Reuse: same key + valid updated_at = return cached analysis/consensus and skip Groq/Gemini (cost savings).
 */

/** Cost decision: 24h TTL per (user, keyword, country) reuses Groq/Gemini/Consensus and avoids repeated paid calls for the same scope. */
export const RESEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/** Logical scope for logging; DB key is always (user_id, keyword, country_code). */
export type ResearchCacheScope = 'insight_tab' | 'stream_report'

export type CacheKeyParts = {
  userId: string
  keyword: string
  countryCode: string
}

/**
 * Build the logical cache key parts used for DB lookups and logging.
 * Single source of truth for "what identifies one cache entry" (keyword + scope = same row; time range = TTL).
 */
export function buildCacheKeyParts(userId: string, keyword: string, countryCode: string): CacheKeyParts {
  return {
    userId,
    keyword: keyword.trim(),
    countryCode: (countryCode || 'KR').trim() || 'KR',
  }
}

/**
 * True if updatedAt is within ttlMs from now. Used to avoid reusing stale cache and to trigger refetch.
 * Cost: returning false forces new AI calls; 24h keeps cost predictable per key per day.
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

/** Age in ms; negative if updatedAt is in the future. */
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
  /** Where the result came from: 'memory' | 'report_id' | 'keyword' */
  source?: string
  /** Short reason: 'full' | 'consensus_only' | 'groq' | 'gemini' | 'groq_and_gemini' | 'expired' | 'write' */
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
export function logCacheEvent(event: 'hit' | 'miss' | 'expired' | 'write', meta: CacheLogMeta): void {
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
