/**
 * 에러 코드 → 유저 친화적 메시지 매핑
 * 상세 보기 모달에서는 실제 코드/메시지 노출
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  PGRST205: '데이터베이스 설정이 완료되지 않았습니다.',
  '42703': '시스템 스키마 오류가 발생했습니다.',
}

interface ErrorDetailPayload {
  code?: string | null
  message?: string | null
  hint?: string | null
  details?: string | null
  /** API 등에서 내려준 error 문자열 */
  error?: string | null
}

export interface FormattedErrorDetail {
  code: string
  message: string
  hint: string
  details: string
}

function normalizeError(err: unknown): ErrorDetailPayload {
  if (err instanceof Error) {
    const e = err as Error & { code?: string; status?: number; hint?: string; details?: string; cause?: unknown }
    let message = err.message
    if (typeof message === 'string' && message.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(message) as { message?: string; error?: string }
        if (parsed && typeof parsed.message === 'string') message = parsed.message
        else if (parsed && typeof parsed.error === 'string') message = parsed.error
      } catch {
        /* keep original message */
      }
    }
    const details = e.details ?? (e.cause != null ? String(e.cause) : null)
    return {
      message,
      code: e.code ?? (e.status != null ? String(e.status) : null),
      hint: e.hint ?? null,
      details,
    }
  }
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>
    const msg = typeof o.message === 'string' && o.message.trim() ? o.message : null
    const errStr = typeof o.error === 'string' && o.error.trim() ? o.error : null
    const codeStr = typeof o.code === 'string' && o.code.trim() ? o.code : null
    const statusStr = o.status != null ? String(o.status) : null
    return {
      code: codeStr || statusStr || null,
      message: msg || errStr || '',
      hint: typeof o.hint === 'string' ? o.hint : null,
      details: typeof o.details === 'string' ? o.details : null,
      error: errStr ?? undefined,
    }
  }
  return { message: String(err), code: null, hint: null, details: null }
}

/** HTML 응답인지 여부 (404 등 에러 페이지) */
function looksLikeHtml(str: string): boolean {
  const t = str.trim()
  return t.startsWith('<') || t.includes('<!DOCTYPE') || t.includes('<!doctype')
}

/** User-facing message for 429/quota so raw codes are not shown. */
const RATE_LIMIT_FRIENDLY = '서버가 혼잡하거나 사용 한도에 도달했어요. 잠시 후 다시 시도해 주세요.'

/** Timeout / network messages */
const TIMEOUT_FRIENDLY = '응답 시간이 초과되었어요. 네트워크를 확인하고 다시 시도해 주세요.'
const NETWORK_FRIENDLY = '네트워크 연결을 확인해 주세요.'

/** 유저에게 보여줄 한 줄 메시지 (토스트용). 코드 매핑 우선, 없으면 message 또는 기본 문구. 운영 환경에서는 HTML/404 상세 숨김. */
export function getFriendlyMessage(err: unknown): string {
  const isDev = process.env.NODE_ENV === 'development'
  const payload = normalizeError(err)
  const code = payload.code ?? (payload as { code?: string }).code
  if (code && FRIENDLY_MESSAGES[code]) {
    return FRIENDLY_MESSAGES[code]
  }
  if (code != null && String(code) === '429') {
    return RATE_LIMIT_FRIENDLY
  }
  const message = payload.message ?? payload.error
  const msgStr = typeof message === 'string' ? message : ''
  if (msgStr.length > 0 && /429|quota|rate limit|한도|사용량 초과|exhausted|resource exhausted/i.test(msgStr)) {
    return RATE_LIMIT_FRIENDLY
  }
  if (msgStr.length > 0 && /timeout|timed ?out|deadline|econnreset|etimedout|504|타임아웃/i.test(msgStr)) {
    return TIMEOUT_FRIENDLY
  }
  if (msgStr.length > 0 && /network|econnrefused|enotfound|fetch failed|load failed/i.test(msgStr)) {
    return NETWORK_FRIENDLY
  }
  if (msgStr.length > 0 && looksLikeHtml(msgStr)) {
    return isDev ? '트렌드 수집에 실패했습니다. 자세히 보기를 눌러 확인하세요.' : '시스템 경로를 찾을 수 없습니다.'
  }
  if (payload.error && typeof payload.error === 'string') {
    return payload.error
  }
  if (msgStr.length > 0) {
    return msgStr
  }
  const status = (err as Error & { status?: number })?.status
  if (!isDev && status === 404) {
    return '시스템 경로를 찾을 수 없습니다.'
  }
  return '에러가 발생했습니다.'
}

/** 상세 모달용 포맷 (code, message, hint, details). 운영 환경에서는 HTML/404 본문을 숨김. */
export function formatErrorDetail(err: unknown): FormattedErrorDetail {
  const isDev = process.env.NODE_ENV === 'development'
  const payload = normalizeError(err)
  // message: 빈 문자열이면 error로 대체 (API가 { error: "..." } 형태로만 반환하는 경우)
  const rawMsg = (payload.message && String(payload.message).trim()) || payload.error || ''
  let message = typeof rawMsg === 'string' && rawMsg.length > 0 ? rawMsg : '—'
  if (!isDev && looksLikeHtml(message)) {
    message = '시스템 경로를 찾을 수 없습니다.'
  }
  // details: 기존 details가 없으면 객체 전체를 JSON으로 보여줌 (디버깅용)
  let details = payload.details ?? '—'
  if (details === '—' && isDev && typeof err === 'object' && err !== null) {
    try {
      const errObj = err as Record<string, unknown>
      const sanitized: Record<string, unknown> = {}
      for (const k of Object.keys(errObj)) {
        if (k !== 'password' && k !== 'token') sanitized[k] = errObj[k]
      }
      const json = JSON.stringify(sanitized, null, 2)
      if (json.length > 0) details = json
    } catch {
      /* ignore */
    }
  }
  if (details === '—' && err instanceof Error && err.stack) {
    details = err.stack
  }
  return {
    code: (payload.code && String(payload.code).trim()) || '—',
    message,
    hint: (payload.hint && String(payload.hint).trim()) || '—',
    details,
  }
}
