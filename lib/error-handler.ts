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
    return {
      message: err.message,
      code: (err as Error & { code?: string }).code ?? null,
      hint: (err as Error & { hint?: string }).hint ?? null,
      details: (err as Error & { details?: string }).details ?? null,
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

/** 유저에게 보여줄 한 줄 메시지 (토스트용). 코드 매핑 우선, 없으면 message 또는 기본 문구 */
export function getFriendlyMessage(err: unknown): string {
  const payload = normalizeError(err)
  const code = payload.code ?? (payload as { code?: string }).code
  if (code && FRIENDLY_MESSAGES[code]) {
    return FRIENDLY_MESSAGES[code]
  }
  if (payload.error && typeof payload.error === 'string') {
    return payload.error
  }
  if (payload.message && typeof payload.message === 'string' && payload.message.length > 0) {
    return payload.message
  }
  return '에러가 발생했습니다.'
}

/** 상세 모달용 포맷 (code, message, hint, details) */
export function formatErrorDetail(err: unknown): FormattedErrorDetail {
  const payload = normalizeError(err)
  return {
    code: payload.code ?? '—',
    message: payload.message ?? payload.error ?? '—',
    hint: payload.hint ?? '—',
    details: payload.details ?? '—',
  }
}
