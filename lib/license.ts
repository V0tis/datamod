/**
 * 서버 전용: Gemini 키는 **설정(DB)에 저장된 사용자 키만** 사용합니다.
 * 서버 환경 변수(GEMINI_API_KEY 등) 폴백은 사용하지 않습니다.
 */

export type LicenseOrigin = 'USER' | 'NONE'

export interface EffectiveLicense {
  gemini: string
  geminiOrigin: LicenseOrigin
  /** 사용자가 DB에 Gemini 키를 넣었는지 */
  canSearch: boolean
}

export function getEffectiveLicenseKeys(userGemini: string | null | undefined): EffectiveLicense {
  const hasUserGemini = !!(userGemini && userGemini.trim())
  const gemini = hasUserGemini ? userGemini!.trim() : ''

  return {
    gemini,
    geminiOrigin: hasUserGemini ? 'USER' : 'NONE',
    canSearch: hasUserGemini,
  }
}
