/**
 * Robust AI response JSON parsing: validation, schema checks, graceful fallback.
 * Never throws; returns safe fallback data on any parse/schema failure.
 */
import { extractJsonFromText, tryRepairTruncatedJson } from '@/lib/extract-json'
import { logger } from '@/lib/logger'

const MAX_JSON_LENGTH = 500_000

/** Quick validation: does text look like JSON (object or array)? */
export function isJsonLike(text: string): boolean {
  const s = (text ?? '').trim()
  if (!s || s.length < 2 || s.length > MAX_JSON_LENGTH) return false
  const first = s[0]
  const last = s[s.length - 1]
  return (
    (first === '{' && last === '}') ||
    (first === '[' && last === ']')
  )
}

export type SafeParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; fallback: T }

export type SafeParseOptions<T> = {
  /** Fallback when parse fails */
  fallback: T
  /** Optional schema validator. Return true if valid. */
  validate?: (parsed: unknown) => parsed is T
  /** Use tryRepairTruncatedJson on parse error */
  repair?: boolean
  /** Log parse failures */
  logFailures?: boolean
  /** Context for logging */
  context?: string
}

/**
 * Safely parse AI response JSON. Never throws.
 * Validates input, attempts repair on truncation, schema-validates, returns fallback on any failure.
 */
export function safeParseAiJson<T>(
  text: string,
  options: SafeParseOptions<T>
): SafeParseResult<T> {
  const { fallback, validate, repair = true, logFailures = true, context } = options

  const raw = extractJsonFromText(typeof text === 'string' ? text : '')
  if (!raw || raw.length > MAX_JSON_LENGTH) {
    if (logFailures && raw) {
      logger.warn('AI JSON: empty or too long', { context, length: raw?.length })
    }
    return { ok: false, fallback }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const parseError = err instanceof Error ? err : new Error(String(err))
    if (repair) {
      const repaired = tryRepairTruncatedJson(raw, parseError)
      if (repaired) {
        try {
          parsed = JSON.parse(repaired)
        } catch {
          if (logFailures) {
            logger.warn('AI JSON: repair failed', {
              context,
              message: parseError.message,
              rawPreview: raw.slice(0, 120),
            })
          }
          return { ok: false, fallback }
        }
      } else {
        if (logFailures) {
          logger.warn('AI JSON: parse failed', {
            context,
            message: parseError.message,
            rawPreview: raw.slice(0, 120),
          })
        }
        return { ok: false, fallback }
      }
    } else {
      if (logFailures) {
        logger.warn('AI JSON: parse failed', { context, message: parseError.message })
      }
      return { ok: false, fallback }
    }
  }

  if (parsed == null || typeof parsed !== 'object') {
    if (logFailures) {
      logger.warn('AI JSON: parsed value not object', { context })
    }
    return { ok: false, fallback }
  }

  if (validate && !validate(parsed)) {
    if (logFailures) {
      logger.warn('AI JSON: schema validation failed', { context })
    }
    return { ok: false, fallback }
  }

  return { ok: true, data: parsed as T }
}

/**
 * Parse JSON and return data or fallback. Convenience wrapper that never throws.
 */
export function parseAiJsonOr<T>(text: string, fallback: T, context?: string): T {
  const result = safeParseAiJson<T>(text, { fallback, logFailures: false, context })
  return result.ok ? result.data : result.fallback
}
