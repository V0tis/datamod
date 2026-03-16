/**
 * Language validation and Korean enforcement for AI outputs.
 * - Check for non-Korean content (except numbers/symbols).
 * - Regenerate or translate so we never show mixed language.
 */
import { containsForeignScript } from '@/lib/text-sanitize'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'

/** Latin letters that might indicate English content (2+ consecutive letters). */
const LATIN_WORDS = /[a-zA-Z]{2,}/g

/**
 * Returns true if text contains non-Korean characters (CJK, Japanese, etc.)
 * or meaningful Latin (English) words. Numbers and symbols are ignored.
 */
export function hasNonKoreanContent(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false
  const t = text.trim()
  if (!t) return false
  if (containsForeignScript(t)) return true
  const latinMatches = t.match(LATIN_WORDS)
  if (latinMatches && latinMatches.length >= 2) return true
  return false
}

const TRANSLATE_TIMEOUT_MS = 8000

/**
 * Translate text to Korean using external API. Used when regenerate fails.
 * On error or timeout returns sanitized text (foreign scripts removed).
 */
export async function translateToKorean(text: string): Promise<string> {
  if (!text || !text.trim()) return text
  try {
    const translate = (await import('google-translate-api-next')).default
    const result = await Promise.race([
      translate(text, { to: 'ko', client: 'gtx' as const }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('translate_timeout')), TRANSLATE_TIMEOUT_MS)),
    ])
    const item = Array.isArray(result) ? result[0] : result
    const translated = (item as { text?: string } | undefined)?.text
    return typeof translated === 'string' ? translated : sanitizeForKoreanDisplay(text)
  } catch {
    return sanitizeForKoreanDisplay(text)
  }
}

/**
 * Ensure text is Korean-only: if it contains non-Korean, try regenerate once,
 * then translate (or sanitize) so we never show mixed language.
 */
export async function ensureKoreanText(
  text: string,
  options: { regenerate?: () => Promise<string> } = {}
): Promise<string> {
  if (!hasNonKoreanContent(text)) return text
  if (options.regenerate) {
    try {
      const retry = await options.regenerate()
      if (!hasNonKoreanContent(retry)) return retry
    } catch {
      // fall through to translate/sanitize
    }
  }
  return translateToKorean(text)
}
