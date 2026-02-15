/**
 * Shared helpers for extracting and repairing JSON from AI response text.
 * Used by research (initial analysis) and stream routes to avoid duplication.
 */

/**
 * Strip markdown code fences (```json ... ``` or ``` ... ```) and return inner text.
 * Single source of truth for "Gemini wrapped JSON" parsing.
 */
export function extractJsonFromText(text: string): string {
  const trimmed = text.trim()
  const codeBlockMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/)
  if (codeBlockMatch) return codeBlockMatch[1].trim()
  if (trimmed.startsWith('```')) {
    const afterOpen = trimmed.replace(/^```(?:json)?\s*\n?/i, '')
    const closeIdx = afterOpen.indexOf('```')
    if (closeIdx !== -1) return afterOpen.slice(0, closeIdx).trim()
    return afterOpen.trim()
  }
  return trimmed
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
