/**
 * Robust AI response JSON parsing: validation, schema checks, graceful fallback.
 * Never throws; returns safe fallback data on any parse/schema failure.
 */
import {
  prepareAiJsonText,
  tryRepairTruncatedJson,
  isJsonBoundaryString,
  sanitizeLlmTextForJsonParse,
} from '@/lib/extract-json'
import { logger } from '@/lib/logger'

const MAX_JSON_LENGTH = 500_000

/** Quick validation: does text look like JSON (object or array)? */
export function isJsonLike(text: string): boolean {
  return isJsonBoundaryString(text)
}

function cloneFallbackDeep<T>(fallback: T): T {
  if (fallback === null || typeof fallback !== 'object') return fallback
  try {
    return structuredClone(fallback)
  } catch {
    try {
      return JSON.parse(JSON.stringify(fallback)) as T
    } catch {
      return fallback
    }
  }
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
 * Pre-process: encoding repair → markdown fence strip → noise stripping → parse → optional repair.
 * Returns a deep-cloned fallback on any failure (data integrity / no shared mutation).
 */
export function safeParseAiJson<T>(
  text: string,
  options: SafeParseOptions<T>
): SafeParseResult<T> {
  const { fallback, validate, repair = true, logFailures = true, context } = options
  const safeFallback = cloneFallbackDeep(fallback)

  const raw = prepareAiJsonText(typeof text === 'string' ? text : '')
  if (!raw || raw.length > MAX_JSON_LENGTH) {
    if (logFailures && raw) {
      logger.warn('AI JSON: empty or too long', { context, length: raw?.length })
    }
    return { ok: false, fallback: safeFallback }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    const parseError = err instanceof Error ? err : new Error(String(err))
    if (repair) {
      const repaired = tryRepairTruncatedJson(raw, parseError)
      if (repaired) {
        const repairedClean = sanitizeLlmTextForJsonParse(repaired)
        try {
          parsed = JSON.parse(repairedClean)
        } catch {
          if (logFailures) {
            logger.warn('AI JSON: repair failed', {
              context,
              message: parseError.message,
              rawPreview: raw.slice(0, 120),
            })
          }
          return { ok: false, fallback: safeFallback }
        }
      } else {
        if (logFailures) {
          logger.warn('AI JSON: parse failed', {
            context,
            message: parseError.message,
            rawPreview: raw.slice(0, 120),
          })
        }
        return { ok: false, fallback: safeFallback }
      }
    } else {
      if (logFailures) {
        logger.warn('AI JSON: parse failed', { context, message: parseError.message })
      }
      return { ok: false, fallback: safeFallback }
    }
  }

  if (parsed == null || typeof parsed !== 'object') {
    if (logFailures) {
      logger.warn('AI JSON: parsed value not object', { context })
    }
    return { ok: false, fallback: safeFallback }
  }

  if (validate && !validate(parsed)) {
    if (logFailures) {
      logger.warn('AI JSON: schema validation failed', { context })
    }
    return { ok: false, fallback: safeFallback }
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
