/**
 * 서버 전용: API 호출 시 사용할 키 결정.
 * 1) DB user_settings에 유저 키가 있으면 해당 키 사용 (origin: USER)
 * 2) 없으면 서버 env 키 사용 (origin: SYSTEM)
 * 키 값은 서버에서만 사용하며 클라이언트에 노출하지 않음.
 */

/** 서버 env에서 Gemini 키 존재 여부 (대시보드 API 연결 상태용). 지원 env: GEMINI_API_KEY, GOOGLE_GENAI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, NEXT_PUBLIC_GEMINI_API_KEY */
export function getSystemGeminiKey(): string {
  const key = (
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_GENAI_API_KEY ??
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ??
    ''
  ).trim()
  return key
}

export type LicenseOrigin = 'USER' | 'SYSTEM'

export interface EffectiveLicense {
  gemini: string
  geminiOrigin: LicenseOrigin
  canSearch: boolean
}

export function getEffectiveLicenseKeys(userGemini: string | null | undefined): EffectiveLicense {
  const systemGemini = getSystemGeminiKey()

  const hasUserGemini = !!(userGemini && userGemini.trim())
  const gemini = hasUserGemini ? userGemini!.trim() : systemGemini

  return {
    gemini,
    geminiOrigin: hasUserGemini ? 'USER' : 'SYSTEM',
    canSearch: gemini.length > 0,
  }
}
