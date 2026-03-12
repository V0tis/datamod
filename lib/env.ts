/**
 * Environment variable validation for production safety.
 * Use getRequiredEnv when the value must exist; use getOptionalEnv with fallback otherwise.
 */

export function getRequiredEnv(key: string): string {
  const val = process.env[key]
  if (val == null || String(val).trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return val.trim()
}

export function getOptionalEnv(key: string, fallback = ''): string {
  const val = process.env[key]
  if (val == null || String(val).trim() === '') return fallback
  return val.trim()
}
