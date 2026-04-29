/**
 * Retry wrapper for AI API calls.
 * 429 rate limit → exponential backoff → retry, max 3 total attempts.
 */
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

/** 연속 Gemini LLM 호출 사이 권장 최소 간격 (RPM 완화) */
export const PIPELINE_LLM_COOLDOWN_MS = 2200

/** Serper 등 외부 검색 병렬 호출을 나눌 때 요청 간 간격 */
export const PIPELINE_WEB_SEARCH_GAP_MS = 1600

/** 인사이트 직후 전략 단계 진입 전 추가 여유 */
export const PIPELINE_STRATEGY_PRE_DELAY_MS = 2600

/** Jitter 80%~120% to avoid thundering herd on retry */
function delayWithJitter(baseMs: number): number {
  const jitter = 0.8 + Math.random() * 0.4
  return Math.round(baseMs * jitter)
}

/** Exponential backoff delay: baseMs * 2^attempt with jitter. */
export function getExponentialDelayMs(attempt: number, baseMs = 1000): number {
  return delayWithJitter(baseMs * Math.pow(2, attempt))
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
 * Execute an AI API call with exponential backoff retry on 429.
 * Delay: base * 2^attempt with jitter. Max 3 total attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryableAiCallOptions<T>
): Promise<T> {
  const { provider, step, onRetry, onError } = options
  const maxRetries = 2
  /** 429 등: 즉시 재시도 금지, 최소 5초대부터 지수 백오프 */
  const baseDelayMs = 5000
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const canRetry = attempt < maxRetries && is429OrQuotaError(err)
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
        console.error('[AI retry]', {
          provider,
          step,
          reason,
          retry_attempt: attempt,
          max_retries: maxRetries,
        })
      }

      if (!canRetry) {
        if (is429OrQuotaError(err)) {
          const { RATE_LIMIT_GRACEFUL_MESSAGE } = await import('@/lib/api/rate-limit')
          throw new Error(RATE_LIMIT_GRACEFUL_MESSAGE)
        }
        throw err
      }

      const delayMs = Math.max(5000, delayWithJitter(baseDelayMs * Math.pow(2, attempt)))
      onRetry?.(attempt + 1)
      await sleep(delayMs)
    }
  }
  throw lastError
}
