/**
 * API rate limit protection: detection, exponential backoff retry, graceful error.
 */

/** User-facing message when rate limit is reached after all retries. */
export const RATE_LIMIT_GRACEFUL_MESSAGE =
  'API 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. 설정에서 키 사용량을 확인할 수 있습니다.'

/**
 * Detects rate limit responses from error or response.
 * Covers: HTTP 429, message body patterns, error.message.
 */
export function isRateLimitResponse(
  err: unknown,
  response?: { status?: number; headers?: Headers; body?: string }
): boolean {
  const status = response?.status ?? (err as { status?: number })?.status
  if (status === 429) return true

  const msg = String(
    (err as { message?: string })?.message ??
      (err as { error?: string })?.error ??
      response?.body ??
      err ??
      ''
  ).toLowerCase()
  const patterns = [
    /429/,
    /too many requests/i,
    /rate limit/i,
    /rate_limit/i,
    /quota/i,
    /resource exhausted/i,
  ]
  return patterns.some((p) => p.test(msg))
}

/**
 * Returns a graceful user-facing message when rate limit is reached.
 */
export function getRateLimitGracefulMessage(): string {
  return RATE_LIMIT_GRACEFUL_MESSAGE
}

const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BASE_DELAY_MS = 1000

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Jitter 80%~120% to avoid thundering herd */
function delayWithJitter(baseMs: number): number {
  const jitter = 0.8 + Math.random() * 0.4
  return Math.round(baseMs * jitter)
}

export interface WithRateLimitRetryOptions {
  maxRetries?: number
  baseDelayMs?: number
  isRetryable?: (err: unknown) => boolean
  onRetry?: (attempt: number, delayMs: number) => void
}

/**
 * Execute fn with exponential backoff retry on rate limit.
 * Throws with graceful message if limit reached after all retries.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: WithRateLimitRetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const isRetryable = options.isRetryable ?? ((e: unknown) => isRateLimitResponse(e))
  const onRetry = options.onRetry

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === maxRetries || !isRetryable(e)) {
        if (isRateLimitResponse(e)) {
          const err = new Error(getRateLimitGracefulMessage()) as Error & { code?: string }
          err.code = 'RATE_LIMIT'
          throw err
        }
        throw e
      }
      const delayMs = delayWithJitter(baseDelayMs * Math.pow(2, attempt))
      onRetry?.(attempt + 1, delayMs)
      await sleep(delayMs)
    }
  }
  throw lastError
}
