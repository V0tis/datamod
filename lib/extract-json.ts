/**
 * Shared helpers for extracting, sanitizing, and repairing JSON from AI response text.
 * Used by research (initial analysis) and stream routes to avoid duplication.
 */
import { repairMultilingualText } from '@/lib/text-encoding-repair'

const MAX_EXTRACT_LENGTH = 500_000

/** True if trimmed text looks like a single JSON object or array. */
export function isJsonBoundaryString(s: string): boolean {
  const t = (s ?? '').trim()
  if (t.length < 2 || t.length > MAX_EXTRACT_LENGTH) return false
  const f = t[0]
  const l = t[t.length - 1]
  return (f === '{' && l === '}') || (f === '[' && l === ']')
}

/**
 * Remove scripts/noise that commonly break PM pipelines (Han, Cyrillic, Thai, etc.)
 * while keeping: ASCII printable, tab/LF/CR, Hangul syllables & Korean jamo blocks.
 * Applied to extracted JSON *text* before JSON.parse — structural ASCII is preserved.
 */
export function sanitizeLlmTextForJsonParse(text: string): string {
  if (text == null || typeof text !== 'string') return ''
  if (!text) return ''
  const out: string[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (isAllowedJsonParseCodePoint(cp)) out.push(ch)
  }
  return out.join('')
}

function isAllowedJsonParseCodePoint(cp: number): boolean {
  if (cp === 0x09 || cp === 0x0a || cp === 0x0d) return true
  if (cp >= 0x20 && cp <= 0x7e) return true
  // Hangul syllables
  if (cp >= 0xac00 && cp <= 0xd7a3) return true
  // Hangul compatibility jamo
  if (cp >= 0x3131 && cp <= 0x318e) return true
  // Hangul Jamo (syllable decomposition, rare in API output but safe to keep)
  if (cp >= 0x1100 && cp <= 0x11ff) return true
  return false
}

/**
 * First balanced `{...}` or `[...]` from first `{`/`[`, respecting strings and escapes.
 */
export function extractBalancedJsonValue(s: string): string | null {
  const start = s.search(/[\[{]/)
  if (start === -1) return null
  const stack: string[] = []
  let inString = false
  let escape = false
  let quote: '"' | "'" = '"'

  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === quote) {
        inString = false
        continue
      }
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      quote = c as '"' | "'"
      continue
    }
    if (c === '{') {
      stack.push('}')
      continue
    }
    if (c === '[') {
      stack.push(']')
      continue
    }
    if (c === '}' || c === ']') {
      if (!stack.length || c !== stack[stack.length - 1]) return null
      stack.pop()
      if (stack.length === 0) return s.slice(start, i + 1)
    }
  }
  return null
}

/**
 * Strip markdown code fences (```json ... ```) and return inner text.
 * Handles: whole-string fence, leading fence, multiple blocks (prefers JSON-shaped candidates),
 * and prose before/after fences. Falls back to balanced `{`/`[` slice.
 */
export function extractJsonFromText(text: string): string {
  const source = (text ?? '').trim()
  if (!source || source.length > MAX_EXTRACT_LENGTH) return ''

  const fencePattern = /```(?:json)?\s*\r?\n?([\s\S]*?)```/gi
  const candidates: string[] = []
  let m: RegExpExecArray | null
  while ((m = fencePattern.exec(source)) !== null) {
    const inner = m[1].trim()
    if (inner) candidates.push(inner)
  }

  if (candidates.length) {
    const sorted = [...candidates].sort((a, b) => b.length - a.length)
    for (const c of sorted) {
      if (isJsonBoundaryString(c)) return c
    }
    const balancedFromFence = sorted.map((c) => extractBalancedJsonValue(c)).filter(Boolean) as string[]
    for (const b of balancedFromFence.sort((a, x) => x.length - a.length)) {
      if (isJsonBoundaryString(b)) return b
    }
    return sorted[0]
  }

  if (source.startsWith('```')) {
    const afterOpen = source.replace(/^```(?:json)?\s*\r?\n?/i, '')
    const closeIdx = afterOpen.indexOf('```')
    const inner = (closeIdx !== -1 ? afterOpen.slice(0, closeIdx) : afterOpen).trim()
    if (inner) {
      if (isJsonBoundaryString(inner)) return inner
      const bal = extractBalancedJsonValue(inner)
      if (bal) return bal
      return inner
    }
  }

  if (isJsonBoundaryString(source)) return source

  const balanced = extractBalancedJsonValue(source)
  if (balanced) return balanced

  return source
}

/**
 * Normalize encoding → extract JSON substring → strip cross-language noise.
 * Use this immediately before JSON.parse in AI pipelines.
 */
export function prepareAiJsonText(raw: string): string {
  const repaired = repairMultilingualText(raw)
  const extracted = extractJsonFromText(repaired)
  return sanitizeLlmTextForJsonParse(extracted)
}

/**
 * Attempt to repair truncated JSON (e.g. "Unterminated string") by closing open brackets/strings.
 * Returns repaired string if it parses, otherwise null.
 */
export function tryRepairTruncatedJson(rawJson: string, parseError: Error): string | null {
  const msg = parseError.message
  const posMatch = msg.match(/position\s+(\d+)/i)
  const pos = posMatch ? Math.min(parseInt(posMatch[1], 10), rawJson.length) : rawJson.length
  if (pos <= 0) return null

  let truncated = rawJson.slice(0, pos).trim()
  if (!truncated) return null

  const isUnterminatedString = /unterminated\s+string/i.test(msg) || msg.includes('Unterminated string')
  if (isUnterminatedString) {
    truncated += '"'
  }

  const trimmedEnd = truncated.trimEnd()
  if (/[,\{]\s*"[^"]*"$/.test(trimmedEnd)) {
    truncated += ': null'
  } else if (/:\s*"([^"\\]|\\.)*$/.test(trimmedEnd)) {
    truncated += '"'
  }

  let openBraces = 0
  let openBrackets = 0
  let inString = false
  let escape = false
  let quoteChar = ''
  for (let i = 0; i < truncated.length; i++) {
    const c = truncated[i]
    if (escape) {
      escape = false
      continue
    }
    if (inString) {
      if (c === '\\') escape = true
      else if (c === quoteChar) inString = false
      continue
    }
    if (c === '"' || c === "'") {
      inString = true
      quoteChar = c
      continue
    }
    if (c === '{') openBraces++
    else if (c === '}') openBraces--
    else if (c === '[') openBrackets++
    else if (c === ']') openBrackets--
  }

  truncated += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces))
  try {
    JSON.parse(truncated)
    return truncated
  } catch {
    return null
  }
}
