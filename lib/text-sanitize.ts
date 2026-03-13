/**
 * AI output text sanitization for Korean-only display.
 *
 * Removes mixed-language contamination (Chinese, Japanese, Thai, etc.),
 * normalizes bullet formatting, and cleans up encoding artifacts.
 */

/** CJK Unified Ideographs – Chinese characters that leak into Korean outputs */
const CJK_IDEOGRAPHS = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g

/** Japanese-only scripts (Hiragana + Katakana) */
const JAPANESE = /[\u3040-\u309f\u30a0-\u30ff]/g

/** Thai script */
const THAI = /[\u0e00-\u0e7f]/g

/** Arabic script */
const ARABIC = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/g

/** Devanagari (Hindi) + other Indic */
const INDIC = /[\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0b00-\u0b7f\u0c00-\u0c7f\u0d00-\u0d7f]/g

/** Cyrillic script (Russian, etc.) */
const CYRILLIC = /[\u0400-\u04ff]/g

/**
 * Combined regex for all foreign scripts to remove.
 * Keeps: Hangul (가-힣, ㄱ-ㅎ, ㅏ-ㅣ), Latin (a-zA-Z), digits, common punctuation, whitespace.
 */
const FOREIGN_SCRIPTS = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff\u3040-\u309f\u30a0-\u30ff\u0e00-\u0e7f\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\u0900-\u097f\u0980-\u09ff\u0a00-\u0a7f\u0b00-\u0b7f\u0c00-\u0c7f\u0d00-\u0d7f\u0400-\u04ff]/g

/** Inconsistent bullet markers → normalized to "- " */
const BULLET_PATTERNS = /^[\s]*(?:•|‣|◦|◆|◇|▸|▹|►|▻|⁃|⦿|⦾|★|☆|✦|✧|❖|⚬|⬥|⬡|→|➤|»|›|※|■|□|▪|▫|○|●|◎|◉|⊙|⊚|✓|✔|✗|✘|⇒|☛|☞)\s*/gm

/** Dash-like bullets that aren't standard "- " (em-dash, en-dash, etc.) */
const DASH_BULLETS = /^[\s]*(?:—|–|―|−|‐|‑|‒)\s*/gm

/** Multiple sequential empty lines → single blank line */
const MULTI_NEWLINES = /\n{3,}/g

/** Trailing spaces on lines */
const TRAILING_SPACES = /[ \t]+$/gm

/** Broken encoding artifacts (common mojibake patterns) */
const ENCODING_ARTIFACTS = /[\ufffd\ufffe\uffff]|â€"|â€™|â€œ|â€\u009d|Ã¢|Â·|Â |â€¢/g

/**
 * Check if a string contains foreign (non-Korean/English/number/punctuation) characters.
 */
export function containsForeignScript(s: string): boolean {
  if (!s) return false
  return FOREIGN_SCRIPTS.test(s)
}

/**
 * Primary sanitizer: clean a single string for Korean display.
 * Removes foreign scripts, normalizes bullets, cleans encoding artifacts.
 */
export function sanitizeForKoreanDisplay(s: string | null | undefined): string {
  if (s == null || typeof s !== 'string') return ''
  let t = s.trim()
  if (!t) return ''

  t = t.replace(ENCODING_ARTIFACTS, '')
  t = t.replace(FOREIGN_SCRIPTS, '')
  t = normalizeBullets(t)
  t = t.replace(MULTI_NEWLINES, '\n\n')
  t = t.replace(TRAILING_SPACES, '')
  t = t.replace(/\s+/g, (match) => (match.includes('\n') ? match : ' '))
  t = t.trim()

  return t || ''
}

/**
 * Normalize bullet formatting to consistent "- " prefix.
 */
export function normalizeBullets(s: string): string {
  let result = s
  result = result.replace(BULLET_PATTERNS, '- ')
  result = result.replace(DASH_BULLETS, '- ')
  return result
}

/**
 * Sanitize an array of strings (e.g. signals, risks, insights).
 * Removes empty items after sanitization.
 */
export function sanitizeStringArray(arr: string[] | null | undefined): string[] {
  if (!Array.isArray(arr)) return []
  return arr
    .map((s) => sanitizeForKoreanDisplay(s))
    .filter((s) => s.length > 0)
}

/**
 * Deep-sanitize a structured object: recursively clean all string values
 * and all string arrays. Non-string/non-array values pass through unchanged.
 */
export function sanitizeDeep<T>(obj: T): T {
  if (obj == null) return obj
  if (typeof obj === 'string') return sanitizeForKoreanDisplay(obj) as T
  if (Array.isArray(obj)) {
    return obj.map((item) => {
      if (typeof item === 'string') return sanitizeForKoreanDisplay(item)
      if (typeof item === 'object' && item !== null) return sanitizeDeep(item)
      return item
    }).filter((item) => {
      if (typeof item === 'string') return item.length > 0
      return true
    }) as T
  }
  if (typeof obj === 'object') {
    const result = {} as Record<string, unknown>
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'string') {
        result[key] = sanitizeForKoreanDisplay(value)
      } else if (Array.isArray(value)) {
        result[key] = sanitizeDeep(value)
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeDeep(value)
      } else {
        result[key] = value
      }
    }
    return result as T
  }
  return obj
}
