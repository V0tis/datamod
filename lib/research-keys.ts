/**
 * Single responsibility: resolve API keys for research flows.
 * Used by research, stream, and insights routes so key logic is not duplicated.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getEffectiveLicenseKeys, getEffectiveOpenAIKey } from '@/lib/license'

export type ResearchKeysResult = {
  gemini: string
  canSearch: boolean
}

/**
 * Resolve Gemini key for a request: user key from DB if logged in, else system env.
 * Returns empty string when no key is available.
 */
export async function getGeminiKeyForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<ResearchKeysResult> {
  let userGemini: string | null = null
  if (userId) {
    const { data: row } = await supabase
      .from('user_settings')
      .select('gemini_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    userGemini = row?.gemini_api_key ?? null
  }
  const effective = getEffectiveLicenseKeys(userGemini)
  return {
    gemini: effective.gemini,
    canSearch: effective.canSearch,
  }
}

/**
 * Resolve OpenAI key for a request: user key from DB if logged in, else system env.
 * Used for research fallback when Gemini is unavailable.
 */
export async function getOpenAIKeyForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<string> {
  let userOpenAI: string | null = null
  if (userId) {
    const { data: row } = await supabase
      .from('user_settings')
      .select('openai_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    userOpenAI = (row as { openai_api_key?: string })?.openai_api_key ?? null
  }
  return getEffectiveOpenAIKey(userOpenAI)
}

export type ResearchKeysForInitialAnalysis = {
  gemini: string
  canSearch: boolean
  openai: string
}

/**
 * One DB query to resolve both Gemini and OpenAI keys for initial research/stream flows.
 * Single responsibility: key resolution only.
 */
export async function getResearchKeysForInitialAnalysis(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<ResearchKeysForInitialAnalysis> {
  let userGemini: string | null = null
  let userOpenAI: string | null = null
  if (userId) {
    const { data: row } = await supabase
      .from('user_settings')
      .select('gemini_api_key, openai_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    userGemini = row?.gemini_api_key ?? null
    userOpenAI = (row as { openai_api_key?: string })?.openai_api_key ?? null
  }
  const effective = getEffectiveLicenseKeys(userGemini)
  return {
    gemini: effective.gemini,
    canSearch: effective.canSearch,
    openai: getEffectiveOpenAIKey(userOpenAI),
  }
}

/**
 * Tab insight API uses server env only (Groq + Gemini). No user keys.
 * Single place for env var names used by insights/tab route.
 */
export function getTabProviderKeys(): { groq: string; gemini: string } {
  return {
    groq: (process.env.GROQ_API_KEY ?? '').trim(),
    gemini: (process.env.GOOGLE_GENAI_API_KEY ?? '').trim(),
  }
}

