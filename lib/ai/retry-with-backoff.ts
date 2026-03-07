/**
 * Retry wrapper for AI API calls.
 * 429 rate limit → wait 2s → retry, max 3 retries.
 */
const RETRY_DELAY_MS = 2000
const MAX_RETRIES = 3

export function is429OrQuotaError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err)
  const status = (err as { status?: number })?.status
  return (
    status === 429 ||
    /429|too many requests/i.test(msg) ||
    /quota|resource exhausted|rate limit/i.test(msg)
  )
}

/** Errors that trigger fallback from Gemini to Groq (instead of failing the step). */
export function isFallbackTriggerError(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err).toLowerCase()
  const status = (err as { status?: number })?.status
  const code = (err as { code?: string })?.code
  return (
    status === 429 ||
    /429|too many requests|quota|resource exhausted|rate limit|rate_limit/i.test(msg) ||
    /timeout|timed out|econnreset|econnrefused|network|network_error/i.test(msg) ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ENOTFOUND'
  )
}

/** Human-readable reason for fallback (e.g. for timeline UI). English for internal use. */
export function getFallbackErrorReason(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err)
  const status = (err as { status?: number })?.status
  if (status === 429 || /429|quota|rate limit/i.test(msg)) return 'quota exceeded'
  if (/timeout|timed out/i.test(msg)) return 'timeout'
  if (/network|econn/i.test(msg)) return 'network error'
  return 'rate limit'
}

/** Korean label for fallback error (UI 표시용). */
export function getFallbackErrorReasonKo(err: unknown): string {
  const msg = String((err as { message?: string })?.message ?? err)
  const status = (err as { status?: number })?.status
  if (status === 429 || /429|quota|rate limit|쿼터|한도|초과/i.test(msg)) return '쿼터 초과'
  if (/timeout|timed out|타임아웃/i.test(msg)) return '타임아웃'
  if (/network|econn|네트워크/i.test(msg)) return '네트워크 오류'
  return '속도 제한'
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type RetryableAiCallOptions<T> = {
  /** Provider name for logging */
  provider: 'gemini' | 'groq'
  /** Step name for logging */
  step: string
  /** Callback invoked before each retry (for UI: "재시도 중...") */
  onRetry?: (attempt: number) => void
  /** Callback for structured error logging */
  onError?: (opts: {
    provider: string
    step: string
    reason: string
    retryAttempt: number
    err: unknown
  }) => void
}

/**
 * Execute an AI API call with retry on 429.
 * Waits 2 seconds between retries, max 3 retries.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryableAiCallOptions<T>
): Promise<T> {
  const { provider, step, onRetry, onError } = options
  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const canRetry = attempt < MAX_RETRIES && is429OrQuotaError(err)
      const reason = is429OrQuotaError(err) ? 'quota_exceeded' : 'api_error'

      if (onError) {
        onError({
          provider,
          step,
          reason,
          retryAttempt: attempt,
          err,
        })
      } else {
        console.log('[AI Error]', {
          provider,
          step,
          reason,
          retry_attempt: attempt,
          max_retries: MAX_RETRIES,
        })
      }

      if (!canRetry) throw err

      onRetry?.(attempt + 1)
      await sleep(RETRY_DELAY_MS)
    }
  }
  throw lastError
}
