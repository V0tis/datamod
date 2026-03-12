/**
 * Production-ready structured logger for Vercel.
 * Outputs JSON lines for log aggregation (Vercel, Datadog, etc).
 */

type LogLevel = 'info' | 'warn' | 'error'

interface LogPayload {
  level: LogLevel
  msg: string
  timestamp: string
  [key: string]: unknown
}

function formatPayload(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const payload: LogPayload = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...meta,
  }
  return JSON.stringify(payload)
}

function log(level: LogLevel, msg: string, meta?: Record<string, unknown>): void {
  const line = formatPayload(level, msg, meta)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
}

/**
 * Wraps an async function and logs execution time.
 */
export async function withTiming<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: Record<string, unknown>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    logger.info(`${label} completed`, {
      ...meta,
      durationMs: Date.now() - start,
    })
    return result
  } catch (err) {
    logger.error(`${label} failed`, {
      ...meta,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}
