/**
 * Gemini(및 외부 API) 호출 시 429 Too Many Requests 대응:
 * - 지수 백오프(Exponential Backoff) + 재시도
 * - 대기 시간에 Jitter 적용으로 동시 재시도 분산
 */

/**
 * Shown when 429/quota/5xx after all retries are exhausted.
 * User can retry manually; stream route may send retryDelay so client auto-retries once.
 */
export const RATE_LIMIT_USER_MESSAGE =
  '서버가 혼잡하여 잠시 후 다시 시도해 주세요.'

const DEFAULT_MAX_RETRIES = 5
const DEFAULT_BASE_DELAY_MS = 1000

/** ms 밀리초 대기 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 대기 시간에 Jitter 적용 (80% ~ 120% 범위)
 * 동시에 많은 요청이 같은 간격으로 재시도하는 것을 방지
 */
export function delayWithJitter(baseMs: number): number {
  const jitter = 0.8 + Math.random() * 0.4
  return Math.round(baseMs * jitter)
}

/**
 * 에러가 429/쿼터/속도제한/5xx 등 재시도 가능한 경우인지 판단
 */
export function isRetryableGeminiError(error: unknown): boolean {
  const msg = String(
    (error as { message?: string })?.message ??
      (error as { status?: number })?.status ??
      error
  )
  return (
    /429|too many requests/i.test(msg) ||
    /quota|resource exhausted|rate limit/i.test(msg) ||
    /5\d{2}/.test(msg) ||
    (typeof (error as { status?: number }).status === 'number' &&
      (error as { status: number }).status >= 500)
  )
}

export type WithBackoffOptions = {
  /** 최대 재시도 횟수 (기본 5 → 총 6회 시도) */
  maxRetries?: number
  /** 1회차 대기 기본값(ms). 2회차 base*2, 3회차 base*4 ... */
  baseDelayMs?: number
  /** 재시도 여부 (기본: 429/quota/rate limit/5xx) */
  isRetryable?: (error: unknown) => boolean
}

/**
 * 지수 백오프 + Jitter 적용 재시도
 * fn이 재시도 가능한 에러를 던지면 baseDelayMs * 2^attempt 에 Jitter를 넣어 대기 후 재시도
 * @throws 마지막 attempt 실패 시 동일 에러를 다시 throw
 */
export async function withExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: WithBackoffOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS
  const isRetryable = options.isRetryable ?? isRetryableGeminiError

  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === maxRetries || !isRetryable(e)) {
        throw e
      }
      const delayMs = delayWithJitter(baseDelayMs * Math.pow(2, attempt))
      await sleep(delayMs)
    }
  }
  throw lastError
}

/**
 * 연속 API 호출 시 요청 사이 간격(ms). Promise.all 대신 순차/지연 호출 시 사용
 */
export const REQUEST_GAP_MS = 500
