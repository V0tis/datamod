/**
 * API route timeout configuration for serverless limits.
 * Vercel: Hobby max 60s, Pro/Enterprise up to 300s (800s with Fluid Compute).
 * Use conservative values so responses return within safe limits.
 */
export const ROUTE_TIMEOUTS = {
  /** Main research analysis (streaming). Pro/Enterprise: 300s. */
  RESEARCH_RUN_SECONDS: 300,
  /** Tab analysis + consensus. Safe for Hobby (60s). */
  INSIGHTS_TAB_SECONDS: 60,
  /** Follow-up Q&A (single AI call). */
  INSIGHTS_FOLLOWUP_SECONDS: 30,
} as const

export const RESEARCH_RUN_DEADLINE_MS = (ROUTE_TIMEOUTS.RESEARCH_RUN_SECONDS - 30) * 1000
