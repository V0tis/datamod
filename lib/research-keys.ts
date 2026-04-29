/**
 * Single responsibility: resolve API keys for research flows.
 * Used by research, stream, and insights routes so key logic is not duplicated.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getEffectiveLicenseKeys } from '@/lib/license'

export type ResearchKeysResult = {
  gemini: string
  canSearch: boolean
}

/**
 * Resolve Gemini key: **사용자 DB에 저장된 키만**. 서버 env 폴백 없음.
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
    if (process.env.NODE_ENV === 'production' || process.env.DEBUG_KEYS === '1') {
      console.info('[ResearchKeys] gemini lookup', {
        userId: userId?.slice(0, 8) + '...',
        hasRow: !!row,
        hasGeminiInRow: !!(row?.gemini_api_key && String(row.gemini_api_key).trim()),
        error: error?.message ?? null,
      })
    }
    userGemini = row?.gemini_api_key ?? null
  }
  const effective = getEffectiveLicenseKeys(userGemini)
  return {
    gemini: effective.gemini,
    canSearch: effective.canSearch,
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

const STEP_AI_COLUMNS = 'ai_primary_model, ai_market_model, ai_competitor_model, ai_insight_model, ai_strategy_model, ai_action_model, ai_risk_model, ai_creative_model, ai_consensus_model'

/**
 * Load all step-level AI settings from user_settings in a single query.
 * Used by analysis pipeline to resolve per-step AI provider.
 */
export async function getStepAISettingsForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<import('@/lib/ai/step-ai-resolver').StepAISettings> {
  const { buildStepAISettings } = await import('@/lib/ai/step-ai-resolver')
  if (!userId) return buildStepAISettings(null)
  const { data: row } = await supabase
    .from('user_settings')
    .select(STEP_AI_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  return buildStepAISettings(row as Record<string, unknown> | null)
}

/**
 * Resolve Groq key: **사용자 DB만**. 서버 env 폴백 없음.
 */
export async function getGroqKeyForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<string> {
  if (!userId) return ''
  const { data: row } = await supabase
    .from('user_settings')
    .select('groq_api_key')
    .eq('user_id', userId)
    .maybeSingle()
  const userGroq = (row as { groq_api_key?: string } | null)?.groq_api_key?.trim()
  return userGroq && userGroq.length > 0 ? userGroq : ''
}

/** Anthropic(Claude) — 선택. 전략 단계 3차 폴백에만 사용 */
export async function getAnthropicKeyForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<string> {
  if (!userId) return ''
  const { data: row } = await supabase
    .from('user_settings')
    .select('anthropic_api_key')
    .eq('user_id', userId)
    .maybeSingle()
  const k = (row as { anthropic_api_key?: string } | null)?.anthropic_api_key?.trim()
  return k && k.length > 0 ? k : ''
}

/**
 * Resolve Serper key: **사용자 DB만**. 서버 env 폴백 없음.
 */
export async function getSerperKeyForRequest(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<string> {
  if (!userId) return ''
  const { data: row } = await supabase
    .from('user_settings')
    .select('serper_api_key')
    .eq('user_id', userId)
    .maybeSingle()
  const userSerper = (row as { serper_api_key?: string } | null)?.serper_api_key?.trim()
  return userSerper && userSerper.length > 0 ? userSerper : ''
}

/**
 * 탭 인사이트 API: 사용자 DB 키만.
 */
export async function getTabProviderKeysForUser(
  supabase: SupabaseClient,
  userId: string | undefined
): Promise<{ groq: string; gemini: string }> {
  const [groq, geminiResult] = await Promise.all([
    getGroqKeyForRequest(supabase, userId),
    getGeminiKeyForRequest(supabase, userId),
  ])
  return { groq, gemini: geminiResult.gemini }
}

