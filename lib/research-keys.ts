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
    const { data: row, error } = await supabase
      .from('user_settings')
      .select('gemini_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[ResearchKeys] user_settings gemini query failed:', error.code, error.message)
    }
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

/** AI 우선 분석: gemini | groq. 기본값 gemini. */
export type AIPrimaryModel = 'gemini' | 'groq'

export async function getAIPrimaryModelForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<AIPrimaryModel> {
  if (!userId) return 'gemini'
  const { data: row } = await supabase
    .from('user_settings')
    .select('ai_primary_model')
    .eq('user_id', userId)
    .maybeSingle()
  const v = (row as { ai_primary_model?: string } | null)?.ai_primary_model
  return v === 'groq' ? 'groq' : 'gemini'
}

/**
 * Resolve Groq key for a request: user key from DB if logged in, else system env.
 */
export async function getGroqKeyForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<string> {
  let userGroq: string | null = null
  if (userId) {
    const { data: row, error } = await supabase
      .from('user_settings')
      .select('groq_api_key')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.warn('[ResearchKeys] user_settings groq query failed:', error.code, error.message)
    }
    userGroq = (row as { groq_api_key?: string } | null)?.groq_api_key ?? null
  }
  const systemGroq = (process.env.GROQ_API_KEY ?? '').trim()
  const hasUser = !!(userGroq && userGroq.trim())
  return hasUser ? userGroq!.trim() : systemGroq
}

/**
 * Tab insight API: prefer user keys, fallback to server env.
 */
export async function getTabProviderKeysForUser(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<{ groq: string; gemini: string }> {
  const [groq, geminiResult] = await Promise.all([
    getGroqKeyForRequest(supabase, userId),
    getGeminiKeyForRequest(supabase, userId),
  ])
  const gemini = geminiResult.gemini || (process.env.GOOGLE_GENAI_API_KEY ?? '').trim()
  return { groq, gemini }
}

/** @deprecated Use getTabProviderKeysForUser for user-based keys. Server env fallback. */
export function getTabProviderKeys(): { groq: string; gemini: string } {
  return {
    groq: (process.env.GROQ_API_KEY ?? '').trim(),
    gemini: (process.env.GOOGLE_GENAI_API_KEY ?? '').trim(),
  }
}

