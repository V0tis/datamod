import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEffectiveLicenseKeys, getEffectiveOpenAIKey, getSystemGeminiKey } from '@/lib/license'

export const dynamic = 'force-dynamic'

/** GET: 현재 사용자 설정 조회. 사용자별 user_settings의 API 키를 반환 (해당 사용자만 조회). */
export async function GET() {
  try {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from('user_settings')
    .select('nickname, gemini_api_key, openai_api_key, anthropic_api_key, groq_api_key, ai_primary_model, ai_market_model, ai_competitor_model, ai_insight_model, ai_strategy_model, ai_action_model, ai_risk_model, ai_creative_model, ai_consensus_model')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[Settings GET]', error)
    return NextResponse.json({ error: '설정을 불러오지 못했습니다.' }, { status: 500 })
  }

  // 디버깅: DB 조회 결과 확인 (연동 미표시 시 터미널에서 확인)
  const hasGeminiInDb = !!(row?.gemini_api_key && String(row.gemini_api_key).trim().length > 0)
  const hasGroqInDb = !!(row && (row as { groq_api_key?: string }).groq_api_key && String((row as { groq_api_key?: string }).groq_api_key).trim().length > 0)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Settings GET] user_id:', user.id, '| row:', !!row, '| hasGeminiInDb:', hasGeminiInDb, '| hasGroqInDb:', hasGroqInDb)
  }

  const effective = getEffectiveLicenseKeys(row?.gemini_api_key)
  const hasGeminiKey = !!(row?.gemini_api_key && row.gemini_api_key.trim().length > 0)
  const hasOpenAIKey = !!(row?.openai_api_key && row.openai_api_key.trim().length > 0)
  const groqKey = (row as { groq_api_key?: string } | undefined)?.groq_api_key?.trim()
  const hasGroqKey = !!(groqKey && groqKey.length > 0)
  const anthKey = (row as { anthropic_api_key?: string } | undefined)?.anthropic_api_key?.trim()
  const hasAnthropicKey = !!(anthKey && anthKey.length > 0)
  const effectiveOpenAI = getEffectiveOpenAIKey(row?.openai_api_key)
  const groqOrigin = hasGroqKey ? 'USER' : (process.env.GROQ_API_KEY?.trim() ? 'SYSTEM' : null)
  const openaiOrigin =
    hasOpenAIKey ? 'USER' : (process.env.OPENAI_API_KEY?.trim() ? 'SYSTEM' : null)
  const anthropicOrigin =
    hasAnthropicKey ? 'USER' : (process.env.ANTHROPIC_API_KEY?.trim() ? 'SYSTEM' : null)

  const systemGemini = getSystemGeminiKey().length > 0
  const systemOpenAI = !!(process.env.OPENAI_API_KEY ?? '').trim()
  const systemAnthropic = !!(process.env.ANTHROPIC_API_KEY ?? '').trim()

  const systemGroq = !!(process.env.GROQ_API_KEY ?? '').trim()

  const aiPrimaryModel = (row as { ai_primary_model?: string } | null)?.ai_primary_model
  const geminiApiKey = hasGeminiKey && row?.gemini_api_key ? String(row.gemini_api_key) : ''
  const groqApiKeyValue = hasGroqKey && groqKey ? groqKey : ''

  const stepRow = row as Record<string, unknown> | null
  const res = NextResponse.json({
    email: user.email ?? '',
    nickname: row?.nickname ?? '',
    aiPrimaryModel: aiPrimaryModel === 'groq' ? 'groq' : 'gemini',
    stepAIModels: {
      ai_market_model: (stepRow?.ai_market_model as string) ?? null,
      ai_competitor_model: (stepRow?.ai_competitor_model as string) ?? null,
      ai_insight_model: (stepRow?.ai_insight_model as string) ?? null,
      ai_strategy_model: (stepRow?.ai_strategy_model as string) ?? null,
      ai_action_model: (stepRow?.ai_action_model as string) ?? null,
      ai_risk_model: (stepRow?.ai_risk_model as string) ?? null,
      ai_creative_model: (stepRow?.ai_creative_model as string) ?? null,
      ai_consensus_model: (stepRow?.ai_consensus_model as string) ?? null,
    },
    hasGeminiKey,
    hasOpenAIKey,
    hasAnthropicKey,
    hasGroqKey,
    geminiApiKey,
    groqApiKey: groqApiKeyValue,
    hasServerGemini: systemGemini,
    hasServerOpenAI: systemOpenAI,
    hasServerAnthropic: systemAnthropic,
    hasServerGroq: systemGroq,
    canSearch: effective.canSearch,
    licenseOrigin: {
      gemini: effective.geminiOrigin,
      groq: groqOrigin ?? (systemGroq ? 'SYSTEM' : null),
      openai: openaiOrigin ?? (effectiveOpenAI ? 'SYSTEM' : null),
      anthropic: anthropicOrigin ?? (systemAnthropic ? 'SYSTEM' : null),
    },
  })
  res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60')
  return res
  } catch (e) {
    console.error('[Settings GET]', e)
    return NextResponse.json({ error: '설정을 불러오지 못했습니다.' }, { status: 500 })
  }
}

/** POST: 설정 저장 (upsert) */
export async function POST(req: Request) {
  try {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    nickname?: string; gemini_api_key?: string; openai_api_key?: string; anthropic_api_key?: string; groq_api_key?: string; ai_primary_model?: string
    ai_market_model?: string | null; ai_competitor_model?: string | null; ai_insight_model?: string | null; ai_strategy_model?: string | null
    ai_action_model?: string | null; ai_risk_model?: string | null; ai_creative_model?: string | null; ai_consensus_model?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nickname =
    typeof body.nickname === 'string' ? body.nickname.trim() || null : undefined
  const gemini_api_key =
    typeof body.gemini_api_key === 'string' ? body.gemini_api_key.trim() || null : undefined
  const openai_api_key =
    typeof body.openai_api_key === 'string' ? body.openai_api_key.trim() || null : undefined
  const anthropic_api_key =
    typeof body.anthropic_api_key === 'string' ? body.anthropic_api_key.trim() || null : undefined
  const groq_api_key =
    typeof body.groq_api_key === 'string' ? body.groq_api_key.trim() || null : undefined
  const ai_primary_model =
    body.ai_primary_model === 'groq' || body.ai_primary_model === 'gemini' ? body.ai_primary_model : undefined

  const parseStepModel = (v: unknown): string | null | undefined => {
    if (v === null) return null
    if (v === 'gemini' || v === 'groq') return v
    return undefined
  }
  const ai_market_model = parseStepModel(body.ai_market_model)
  const ai_competitor_model = parseStepModel(body.ai_competitor_model)
  const ai_insight_model = parseStepModel(body.ai_insight_model)
  const ai_strategy_model = parseStepModel(body.ai_strategy_model)
  const ai_action_model = parseStepModel(body.ai_action_model)
  const ai_risk_model = parseStepModel(body.ai_risk_model)
  const ai_creative_model = parseStepModel(body.ai_creative_model)
  const ai_consensus_model = parseStepModel(body.ai_consensus_model)

  const { data: existing } = await supabase
    .from('user_settings')
    .select('nickname, gemini_api_key, openai_api_key, anthropic_api_key, groq_api_key, ai_primary_model, ai_market_model, ai_competitor_model, ai_insight_model, ai_strategy_model, ai_action_model, ai_risk_model, ai_creative_model, ai_consensus_model')
    .eq('user_id', user.id)
    .maybeSingle()

  const ex = existing as Record<string, unknown> | null
  const mergeStep = (newVal: string | null | undefined, col: string) =>
    newVal !== undefined ? newVal : (ex?.[col] as string | null) ?? null

  const merged = {
    user_id: user.id,
    nickname: nickname !== undefined ? nickname : existing?.nickname ?? null,
    gemini_api_key:
      gemini_api_key !== undefined ? gemini_api_key : existing?.gemini_api_key ?? null,
    openai_api_key:
      openai_api_key !== undefined ? openai_api_key : existing?.openai_api_key ?? null,
    anthropic_api_key:
      anthropic_api_key !== undefined ? anthropic_api_key : (ex?.anthropic_api_key as string | null) ?? null,
    groq_api_key:
      groq_api_key !== undefined ? groq_api_key : (ex?.groq_api_key as string | null) ?? null,
    ai_primary_model:
      ai_primary_model !== undefined ? ai_primary_model : (ex?.ai_primary_model as string | null) ?? null,
    ai_market_model: mergeStep(ai_market_model, 'ai_market_model'),
    ai_competitor_model: mergeStep(ai_competitor_model, 'ai_competitor_model'),
    ai_insight_model: mergeStep(ai_insight_model, 'ai_insight_model'),
    ai_strategy_model: mergeStep(ai_strategy_model, 'ai_strategy_model'),
    ai_action_model: mergeStep(ai_action_model, 'ai_action_model'),
    ai_risk_model: mergeStep(ai_risk_model, 'ai_risk_model'),
    ai_creative_model: mergeStep(ai_creative_model, 'ai_creative_model'),
    ai_consensus_model: mergeStep(ai_consensus_model, 'ai_consensus_model'),
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase.from('user_settings').upsert(merged, {
    onConflict: 'user_id',
  })

  if (error) {
    console.error('[Settings POST]', error)
    return NextResponse.json({ error: '설정 저장에 실패했습니다.' }, { status: 500 })
  }

  if (nickname !== undefined && user.email) {
    await supabase
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email, nickname: merged.nickname },
        { onConflict: 'id' }
      )
  }

  return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Settings POST]', e)
    return NextResponse.json({ error: '설정 저장에 실패했습니다.' }, { status: 500 })
  }
}
