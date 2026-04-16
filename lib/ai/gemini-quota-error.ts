/**
 * Gemini / Google Generative Language API 429·RESOURCE_EXHAUSTED 응답에서
 * 권장 재시도 대기 시간(retryDelay)을 추출한다.
 */

const MAX_RETRY_WAIT_MS = 120_000
const MIN_RETRY_WAIT_MS = 1_000

function clampDelay(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return Math.min(MAX_RETRY_WAIT_MS, Math.max(MIN_RETRY_WAIT_MS, Math.round(ms)))
}

/** Google RPC JSON body에서 RetryInfo.retryDelay ("15s" 등) 파싱 */
export function parseRetryDelayMsFromGoogleRpcBody(body: unknown): number {
  if (!body || typeof body !== 'object') return 0
  const err = (body as { error?: unknown }).error
  if (!err || typeof err !== 'object') return 0
  const details = (err as { details?: unknown }).details
  if (!Array.isArray(details)) return 0
  for (const d of details) {
    if (!d || typeof d !== 'object') continue
    const o = d as Record<string, unknown>
    const t = typeof o['@type'] === 'string' ? o['@type'] : ''
    if (!t.includes('RetryInfo')) continue
    const rd = o.retryDelay
    if (typeof rd === 'string' && /^\d+s$/i.test(rd.trim())) {
      const sec = parseInt(rd.trim().replace(/s$/i, ''), 10)
      if (Number.isFinite(sec) && sec > 0) return clampDelay(sec * 1000)
    }
    if (typeof rd === 'number' && rd > 0) return clampDelay(rd * 1000)
  }
  return 0
}

function collectErrorStrings(err: unknown, depth = 0): string {
  if (depth > 6) return ''
  if (err == null) return ''
  if (typeof err === 'string') return err
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause
    return `${err.message}\n${collectErrorStrings(cause, depth + 1)}`
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

/**
 * SDK·REST·래핑 에러에서 retryDelay(초 단위 문자열 등) 또는 retryAfterMs 힌트를 ms로 반환.
 * 없으면 0 (호출부에서 0이면 지수 백오프만 사용).
 */
export function extractGemini429RetryDelayMs(err: unknown): number {
  const e = err as { retryAfterMs?: number; status?: number }
  if (typeof e.retryAfterMs === 'number' && e.retryAfterMs > 0) {
    return clampDelay(e.retryAfterMs)
  }
  const blob = collectErrorStrings(err)
  if (!blob) return 0

  let m = /"retryDelay"\s*:\s*"(\d+)s"/i.exec(blob)
  if (m) return clampDelay(parseInt(m[1], 10) * 1000)

  m = /retryDelay['"`]?\s*:\s*['"`]?(\d+)s/i.exec(blob)
  if (m) return clampDelay(parseInt(m[1], 10) * 1000)

  m = /retry after ([\d.]+)\s*s(ec)?/i.exec(blob)
  if (m) return clampDelay(parseFloat(m[1]) * 1000)

  m = /retry in ([\d.]+)\s*s(ec)?/i.exec(blob)
  if (m) return clampDelay(parseFloat(m[1]) * 1000)

  return 0
}
