/**
 * Single source of truth for AI provider display names.
 * Used by timeline, result page, and API so we don't hardcode names in UI.
 */
export type AnalysisProviderId = 'gemini' | 'groq' | null

export const PRIMARY_MODEL_ID = 'gemini' as const
export const FALLBACK_MODEL_ID = 'groq' as const

const DISPLAY_NAMES: Record<NonNullable<AnalysisProviderId>, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
}

/**
 * Returns human-readable model label for timeline and AI 분석 엔진 section.
 * @param provider - from analysis task metadata
 * @param fallbackUsed - when true, used fallback model
 * @param primaryProviderError - when fallback, reason primary failed (e.g. "quota exceeded")
 */
export function getProviderDisplayName(
  provider: AnalysisProviderId | string | null,
  fallbackUsed?: boolean,
  primaryProviderError?: string | null
): string {
  if (provider == null) return ''
  if (fallbackUsed && primaryProviderError) {
    return `Gemini → Failed (${primaryProviderError}) · Groq → Success`
  }
  const name = (provider === 'gemini' || provider === 'groq' ? DISPLAY_NAMES[provider] : null) ?? String(provider)
  return fallbackUsed ? `${name} (Fallback)` : name
}

export function getPrimaryModelDisplayName(): string {
  return DISPLAY_NAMES[PRIMARY_MODEL_ID]
}

export function getFallbackModelDisplayName(): string {
  return DISPLAY_NAMES[FALLBACK_MODEL_ID]
}
