import type { SupabaseClient } from '@supabase/supabase-js'

export type LlmUsageInsert = {
  userId: string
  analysisId?: string
  stepName: string
  provider: 'gemini' | 'groq'
  model: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  fallbackUsed?: boolean
  longContextRoute?: boolean
}

/**
 * 분석 파이프라인에서 LLM 1회 호출 기록. 실패 시 로그만 (파이프라인 중단 없음).
 */
export async function recordLlmUsage(supabase: SupabaseClient, row: LlmUsageInsert): Promise<void> {
  try {
    const total =
      row.totalTokens ??
      (row.promptTokens != null && row.completionTokens != null
        ? row.promptTokens + row.completionTokens
        : undefined)
    await supabase.from('llm_usage_log').insert({
      user_id: row.userId,
      analysis_id: row.analysisId ?? null,
      step_name: row.stepName,
      provider: row.provider,
      model: row.model,
      prompt_tokens: row.promptTokens ?? null,
      completion_tokens: row.completionTokens ?? null,
      total_tokens: total ?? null,
      fallback_used: row.fallbackUsed ?? false,
      long_context_route: row.longContextRoute ?? false,
    })
  } catch (e) {
    console.warn('[llm_usage_log] insert failed:', e)
  }
}

export type LlmUsageTotals = {
  totalPromptTokens: number
  totalCompletionTokens: number
  totalTokens: number
  callCount: number
}

export async function getUserLlmUsageTotals(supabase: SupabaseClient, userId: string): Promise<LlmUsageTotals> {
  const { data, error } = await supabase
    .from('llm_usage_log')
    .select('prompt_tokens, completion_tokens, total_tokens')
    .eq('user_id', userId)

  if (error || !data?.length) {
    return { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, callCount: 0 }
  }

  let totalPromptTokens = 0
  let totalCompletionTokens = 0
  let totalTokens = 0
  for (const r of data) {
    const p = typeof r.prompt_tokens === 'number' ? r.prompt_tokens : 0
    const c = typeof r.completion_tokens === 'number' ? r.completion_tokens : 0
    const t = typeof r.total_tokens === 'number' ? r.total_tokens : p + c
    totalPromptTokens += p
    totalCompletionTokens += c
    totalTokens += t > 0 ? t : p + c
  }
  return {
    totalPromptTokens,
    totalCompletionTokens,
    totalTokens,
    callCount: data.length,
  }
}
