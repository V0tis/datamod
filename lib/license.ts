/**
 * 서버 전용: API 호출 시 사용할 키 결정.
 * 1) DB user_settings에 유저 키가 있으면 해당 키 사용 (origin: USER)
 * 2) 없으면 서버 env 키 사용 (origin: SYSTEM)
 * 키 값은 서버에서만 사용하며 클라이언트에 노출하지 않음.
 */
export type LicenseOrigin = 'USER' | 'SYSTEM'

export interface EffectiveLicense {
  gemini: string
  geminiOrigin: LicenseOrigin
  canSearch: boolean
}

export function getEffectiveLicenseKeys(userGemini: string | null | undefined): EffectiveLicense {
  const systemGemini =
    (process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '').trim()

  const hasUserGemini = !!(userGemini && userGemini.trim())
  const gemini = hasUserGemini ? userGemini!.trim() : systemGemini

  return {
    gemini,
    geminiOrigin: hasUserGemini ? 'USER' : 'SYSTEM',
    canSearch: gemini.length > 0,
  }
}

/** OpenAI 키: 사용자 입력 키 우선, 없으면 env. (분석 리포트 탭·Fallback) */
export function getEffectiveOpenAIKey(userOpenAI: string | null | undefined): string {
  const systemOpenAI = (process.env.OPENAI_API_KEY ?? '').trim()
  const hasUser = !!(userOpenAI && userOpenAI.trim())
  return hasUser ? userOpenAI!.trim() : systemOpenAI
}

/** Anthropic(Claude) 키: 사용자 입력 키 우선, 없으면 env. (인사이트 탭) */
export function getEffectiveAnthropicKey(userAnthropic: string | null | undefined): string {
  const system = (process.env.ANTHROPIC_API_KEY ?? '').trim()
  const hasUser = !!(userAnthropic && userAnthropic.trim())
  return hasUser ? userAnthropic!.trim() : system
}
