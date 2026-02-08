/**
 * 서버 전용: API 호출 시 사용할 키 결정.
 * 1) DB user_settings에 유저 키가 있으면 해당 키 사용 (origin: USER)
 * 2) 없으면 서버 env 키 사용 (origin: SYSTEM)
 * 키 값은 서버에서만 사용하며 클라이언트에 노출하지 않음.
 */
export type LicenseOrigin = 'USER' | 'SYSTEM'

export interface EffectiveLicense {
  gemini: string
  firecrawl: string
  geminiOrigin: LicenseOrigin
  firecrawlOrigin: LicenseOrigin
  canSearch: boolean
}

export function getEffectiveLicenseKeys(
  userGemini: string | null | undefined,
  userFirecrawl: string | null | undefined
): EffectiveLicense {
  const systemGemini =
    (process.env.NEXT_PUBLIC_GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? '').trim()
  const systemFirecrawl = (process.env.FIRECRAWL_API_KEY ?? '').trim()

  const hasUserGemini = !!(userGemini && userGemini.trim())
  const hasUserFirecrawl = !!(userFirecrawl && userFirecrawl.trim())

  const gemini = hasUserGemini ? userGemini!.trim() : systemGemini
  const firecrawl = hasUserFirecrawl ? userFirecrawl!.trim() : systemFirecrawl

  return {
    gemini,
    firecrawl,
    geminiOrigin: hasUserGemini ? 'USER' : 'SYSTEM',
    firecrawlOrigin: hasUserFirecrawl ? 'USER' : 'SYSTEM',
    canSearch: gemini.length > 0 && firecrawl.length > 0,
  }
}
