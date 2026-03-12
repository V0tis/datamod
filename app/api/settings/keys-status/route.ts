import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveLicenseKeys, getEffectiveOpenAIKey } from '@/lib/license'

/**
 * GET: 현재 사용자의 API 키 설정 여부 (AI 분석 가능 여부)
 * - 로그인 안 되어 있으면 401
 * - hasRequiredKeys: Gemini 또는 OpenAI 중 하나라도 설정되어 있으면 true
 */
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
    .select('gemini_api_key, openai_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[KeysStatus GET]', error)
    return NextResponse.json({ error: '설정을 확인하지 못했습니다.' }, { status: 500 })
  }

  const effective = getEffectiveLicenseKeys(row?.gemini_api_key)
  const hasGemini = effective.canSearch && !!effective.gemini
  const openaiKey = getEffectiveOpenAIKey(row?.openai_api_key)
  const hasOpenAI = !!(openaiKey && openaiKey.length > 0)
  const hasRequiredKeys = hasGemini || hasOpenAI

  return NextResponse.json({ hasRequiredKeys })
  } catch (e) {
    console.error('[KeysStatus GET]', e)
    return NextResponse.json({ error: '설정을 확인하지 못했습니다.' }, { status: 500 })
  }
}
