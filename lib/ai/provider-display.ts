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

/** primary_provider_error (영문) → 한국어 라벨 */
const ERROR_KO: Record<string, string> = {
  'quota exceeded': '쿼터 초과',
  timeout: '타임아웃',
  'network error': '네트워크 오류',
  'rate limit': '속도 제한',
}

/** Returns Korean label for provider status (모델 상태, 분석 단계). */
export function getProviderStatusKo(
  primaryProvider: string | null,
  fallbackProvider: string | null,
  fallbackUsed: boolean,
  primaryProviderError?: string | null,
  status: 'completed' | 'running' = 'completed'
): string {
  const errKo = primaryProviderError ? (ERROR_KO[primaryProviderError] ?? primaryProviderError.replace(/_/g, ' ')) : ''
  if (fallbackUsed && primaryProvider && fallbackProvider && errKo) {
    const success = status === 'completed' ? '성공' : '실행 중'
    return `${primaryProvider} → 실패 (${errKo})\n${fallbackProvider} → ${success}`
  }
  const name = primaryProvider || fallbackProvider || ''
  return fallbackUsed ? `${name} (폴백)` : name || ''
}

/**
 * Returns human-readable model label for timeline and AI 분석 엔진 section.
 * @param provider - from analysis task metadata (actual provider used)
 * @param fallbackUsed - when true, used fallback model
 * @param primaryProviderError - when fallback, reason primary failed (e.g. "quota exceeded")
 */
export function getProviderDisplayName(
  provider: AnalysisProviderId | string | null,
  fallbackUsed?: boolean,
  primaryProviderError?: string | null
): string {
  if (provider == null) return ''
  const errKo = primaryProviderError ? (ERROR_KO[primaryProviderError] ?? primaryProviderError) : ''
  if (fallbackUsed && primaryProviderError) {
    const primary = provider === 'groq' ? 'Gemini' : 'Groq'
    const fallback = provider === 'groq' ? 'Groq' : 'Gemini'
    return `${primary} → 실패 (${errKo})\n${fallback} → 성공`
  }
  const name = (provider === 'gemini' || provider === 'groq' ? DISPLAY_NAMES[provider] : null) ?? String(provider)
  return fallbackUsed ? `${name} (폴백)` : name
}

export function getPrimaryModelDisplayName(): string {
  return DISPLAY_NAMES[PRIMARY_MODEL_ID]
}

export function getFallbackModelDisplayName(): string {
  return DISPLAY_NAMES[FALLBACK_MODEL_ID]
}
