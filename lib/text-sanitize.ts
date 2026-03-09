/**
 * Sanitize AI output for display: remove/replace non-Korean script (e.g. Chinese)
 * so that mixed "글로벌经济 불안정성" becomes "글로벌 불안정성".
 * Keeps: Hangul, Latin, numbers, spaces, basic punctuation.
 */

/** CJK Unified Ideographs (Chinese, etc.) range – remove for Korean-only display */
const CJK_IDEOGRAPHS = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g

export function sanitizeForKoreanDisplay(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return ''
  const t = s.trim()
  if (!t) return ''
  return t.replace(CJK_IDEOGRAPHS, '').replace(/\s+/g, ' ').trim() || t
}
