/**
 * 에러 코드 → 유저 친화적 메시지 매핑
 * 상세 보기 모달에서는 실제 코드/메시지 노출
 */
const FRIENDLY_MESSAGES: Record<string, string> = {
  PGRST205: '데이터베이스 설정이 완료되지 않았습니다.',
  '42703': '시스템 스키마 오류가 발생했습니다.',
}

export interface ErrorDetailPayload {
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
    const e = err as Error & { code?: string; status?: number; hint?: string; details?: string }
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
    return {
      message,
      code: e.code ?? (e.status != null ? String(e.status) : null),
      hint: e.hint ?? null,
      details: e.details ?? null,
    }
  }
  if (typeof err === 'object' && err !== null) {
    const o = err as Record<string, unknown>
    return {
      code: typeof o.code === 'string' ? o.code : String(o.code ?? ''),
      message: typeof o.message === 'string' ? o.message : String(o.message ?? ''),
      hint: typeof o.hint === 'string' ? o.hint : String(o.hint ?? ''),
      details: typeof o.details === 'string' ? o.details : String(o.details ?? ''),
      error: typeof o.error === 'string' ? o.error : undefined,
    }
  }
  return { message: String(err), code: null, hint: null, details: null }
}

/** HTML 응답인지 여부 (404 등 에러 페이지) */
function looksLikeHtml(str: string): boolean {
  const t = str.trim()
  return t.startsWith('<') || t.includes('<!DOCTYPE') || t.includes('<!doctype')
}

/** 유저에게 보여줄 한 줄 메시지 (토스트용). 코드 매핑 우선, 없으면 message 또는 기본 문구. 운영 환경에서는 HTML/404 상세 숨김. */
export function getFriendlyMessage(err: unknown): string {
  const isDev = process.env.NODE_ENV === 'development'
  const payload = normalizeError(err)
  const code = payload.code ?? (payload as { code?: string }).code
  if (code && FRIENDLY_MESSAGES[code]) {
    return FRIENDLY_MESSAGES[code]
  }
  const message = payload.message ?? payload.error
  const msgStr = typeof message === 'string' ? message : ''
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
  let message = payload.message ?? payload.error ?? '—'
  const msgStr = typeof message === 'string' ? message : String(message)
  if (!isDev && looksLikeHtml(msgStr)) {
    message = '시스템 경로를 찾을 수 없습니다.'
  }
  return {
    code: payload.code ?? '—',
    message: msgStr.length > 0 ? message : '—',
    hint: payload.hint ?? '—',
    details: payload.details ?? '—',
  }
}
