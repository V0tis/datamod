/**
 * Reliable AI API: timeout, retry, malformed response handling.
 */

export const AI_FALLBACK_MESSAGES = {
  GENERIC: 'AI 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
  QUOTA: '서버가 혼잡하여 잠시 후 다시 시도해 주세요.',
  TIMEOUT: '요청 시간이 초과되었습니다. 다시 시도해 주세요.',
  NETWORK: '네트워크 연결을 확인해 주세요.',
} as const

const DEFAULT_TIMEOUT_MS = 90_000

/** Max retries for AI calls (initial attempt + 2 retries = 3 total). */
export const AI_MAX_RETRIES = 2

/**
 * Fetch with timeout. Aborts after timeoutMs.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchInit } = init
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: fetchInit.signal ?? controller.signal,
    })
    return res
  } finally {
    clearTimeout(id)
  }
}

/**
 * Wrap any Promise with a timeout. Rejects if not resolved within ms.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('AI_TIMEOUT')), ms)
  )
  return Promise.race([promise, timeout])
}
