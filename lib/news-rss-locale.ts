/**
 * Country → Google News RSS locale (gl=region, hl=language, ceid).
 * Used by news API and research pipeline to fetch region-appropriate news.
 */
export const NEWS_LOCALE: Record<string, { gl: string; hl: string; ceid: string }> = {
  KR: { gl: 'KR', hl: 'ko', ceid: 'KR:ko' },
  US: { gl: 'US', hl: 'en', ceid: 'US:en' },
  GB: { gl: 'GB', hl: 'en', ceid: 'GB:en' },
  JP: { gl: 'JP', hl: 'ja', ceid: 'JP:ja' },
  TW: { gl: 'TW', hl: 'zh-TW', ceid: 'TW:zh-Hant' },
  HK: { gl: 'HK', hl: 'zh-TW', ceid: 'HK:zh-Hant' },
  DE: { gl: 'DE', hl: 'de', ceid: 'DE:de' },
}

const DEFAULT = NEWS_LOCALE.KR

export function getNewsLocale(country: string): { gl: string; hl: string; ceid: string } {
  const code = (country ?? 'KR').trim().toUpperCase()
  return NEWS_LOCALE[code] ?? DEFAULT
}
