import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEffectiveLicenseKeys, getEffectiveOpenAIKey, getEffectiveAnthropicKey, getSystemGeminiKey } from '@/lib/license'

/** GET: 현재 사용자 설정 조회 (키 원문은 절대 노출하지 않음) + 검색 가능 여부 + 키 출처 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row, error } = await supabase
    .from('user_settings')
    .select('nickname, gemini_api_key, openai_api_key, anthropic_api_key, groq_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[Settings GET]', error)
    return NextResponse.json({ error: '설정을 불러오지 못했습니다.' }, { status: 500 })
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

  return NextResponse.json({
    email: user.email ?? '',
    nickname: row?.nickname ?? '',
    hasGeminiKey,
    hasOpenAIKey,
    hasAnthropicKey,
    hasGroqKey,
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
}

/** POST: 설정 저장 (upsert) */
export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { nickname?: string; gemini_api_key?: string; openai_api_key?: string; anthropic_api_key?: string; groq_api_key?: string }
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

  const { data: existing } = await supabase
    .from('user_settings')
    .select('nickname, gemini_api_key, openai_api_key, anthropic_api_key, groq_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  const merged = {
    user_id: user.id,
    nickname: nickname !== undefined ? nickname : existing?.nickname ?? null,
    gemini_api_key:
      gemini_api_key !== undefined ? gemini_api_key : existing?.gemini_api_key ?? null,
    openai_api_key:
      openai_api_key !== undefined ? openai_api_key : existing?.openai_api_key ?? null,
    anthropic_api_key:
      anthropic_api_key !== undefined ? anthropic_api_key : (existing as { anthropic_api_key?: string } | null)?.anthropic_api_key ?? null,
    groq_api_key:
      groq_api_key !== undefined ? groq_api_key : (existing as { groq_api_key?: string } | null)?.groq_api_key ?? null,
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
}
