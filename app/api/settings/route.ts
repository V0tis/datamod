import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEffectiveLicenseKeys } from '@/lib/license'

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
    .select('gemini_api_key, groq_api_key, serper_api_key, ai_primary_model, analysis_depth, ai_market_model, ai_competitor_model, ai_insight_model, ai_strategy_model, ai_action_model, ai_risk_model, ai_creative_model, ai_consensus_model')
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
  }

  const effective = getEffectiveLicenseKeys(row?.gemini_api_key)
  const hasGeminiKey = !!(row?.gemini_api_key && row.gemini_api_key.trim().length > 0)
  const groqKey = (row as { groq_api_key?: string } | undefined)?.groq_api_key?.trim()
  const hasGroqKey = !!(groqKey && groqKey.length > 0)
  /** DB에 저장된 키만: Gemini 우선이면 Gemini, Groq 우선이면 Groq 필요 */
  const aiPrimary = (row as { ai_primary_model?: string } | null)?.ai_primary_model
  const canSearchAny =
    aiPrimary === 'groq' ? hasGroqKey : hasGeminiKey
  const serperKey = (row as { serper_api_key?: string } | undefined)?.serper_api_key?.trim()
  const hasSerperKey = !!(serperKey && serperKey.length > 0)
  const groqOrigin = hasGroqKey ? 'USER' : null

  const aiPrimaryModel = aiPrimary
  const geminiApiKey = hasGeminiKey && row?.gemini_api_key ? String(row.gemini_api_key) : ''
  const groqApiKeyValue = hasGroqKey && groqKey ? groqKey : ''

  const stepRow = row as Record<string, unknown> | null
  const analysisDepth = (stepRow?.analysis_depth as string) === 'fast' || (stepRow?.analysis_depth as string) === 'deep'
    ? (stepRow?.analysis_depth as 'fast' | 'deep')
    : 'standard'
  const res = NextResponse.json({
    email: user.email ?? '',
    aiPrimaryModel: aiPrimaryModel === 'groq' ? 'groq' : 'gemini',
    analysisDepth,
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
    hasGroqKey,
    hasSerperKey,
    geminiApiKey,
    groqApiKey: groqApiKeyValue,
    serperApiKey: hasSerperKey && serperKey ? serperKey : '',
    /** 서버 env 키 폴백 미사용 — UI 호환용 false */
    hasServerGemini: false,
    hasServerGroq: false,
    hasServerSerper: false,
    canSearch: canSearchAny,
    licenseOrigin: {
      gemini: effective.geminiOrigin,
      groq: groqOrigin,
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
    gemini_api_key?: string; groq_api_key?: string; serper_api_key?: string; ai_primary_model?: string
    analysis_depth?: string
    ai_market_model?: string | null; ai_competitor_model?: string | null; ai_insight_model?: string | null; ai_strategy_model?: string | null
    ai_action_model?: string | null; ai_risk_model?: string | null; ai_creative_model?: string | null; ai_consensus_model?: string | null
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const gemini_api_key =
    typeof body.gemini_api_key === 'string' ? body.gemini_api_key.trim() || null : undefined
  const groq_api_key =
    typeof body.groq_api_key === 'string' ? body.groq_api_key.trim() || null : undefined
  const serper_api_key =
    typeof body.serper_api_key === 'string' ? body.serper_api_key.trim() || null : undefined
  const ai_primary_model =
    body.ai_primary_model === 'groq' || body.ai_primary_model === 'gemini' ? body.ai_primary_model : undefined
  const analysis_depth =
    body.analysis_depth === 'fast' || body.analysis_depth === 'deep' ? body.analysis_depth : body.analysis_depth === 'standard' ? 'standard' : undefined

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
    .select('gemini_api_key, openai_api_key, anthropic_api_key, groq_api_key, serper_api_key, ai_primary_model, analysis_depth, ai_market_model, ai_competitor_model, ai_insight_model, ai_strategy_model, ai_action_model, ai_risk_model, ai_creative_model, ai_consensus_model')
    .eq('user_id', user.id)
    .maybeSingle()

  const ex = existing as Record<string, unknown> | null
  const mergeStep = (newVal: string | null | undefined, col: string) =>
    newVal !== undefined ? newVal : (ex?.[col] as string | null) ?? null

  const merged = {
    user_id: user.id,
    gemini_api_key:
      gemini_api_key !== undefined ? gemini_api_key : existing?.gemini_api_key ?? null,
    /** 레거시 컬럼 유지 (API로 더 이상 변경하지 않음) */
    openai_api_key: (ex?.openai_api_key as string | null) ?? null,
    anthropic_api_key: (ex?.anthropic_api_key as string | null) ?? null,
    groq_api_key:
      groq_api_key !== undefined ? groq_api_key : (ex?.groq_api_key as string | null) ?? null,
    serper_api_key:
      serper_api_key !== undefined ? serper_api_key : (ex?.serper_api_key as string | null) ?? null,
    ai_primary_model:
      ai_primary_model !== undefined ? ai_primary_model : (ex?.ai_primary_model as string | null) ?? null,
    analysis_depth:
      analysis_depth !== undefined ? analysis_depth : (ex?.analysis_depth as string | null) ?? 'standard',
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

  return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[Settings POST]', e)
    return NextResponse.json({ error: '설정 저장에 실패했습니다.' }, { status: 500 })
  }
}
