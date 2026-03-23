import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
/**
 * GET: 현재 사용자의 API 키 설정 여부 (AI 분석 가능 여부)
 * - 로그인 안 되어 있으면 401
 * - hasRequiredKeys: DB에 Gemini 또는 Groq(우선 모델에 맞게)가 있으면 true
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
    .select('gemini_api_key, groq_api_key, ai_primary_model')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[KeysStatus GET]', error)
    return NextResponse.json({ error: '설정을 확인하지 못했습니다.' }, { status: 500 })
  }

  const hasGemini = !!(row?.gemini_api_key && String(row.gemini_api_key).trim())
  const hasGroq = !!((row as { groq_api_key?: string })?.groq_api_key?.trim())
  const primary = (row as { ai_primary_model?: string })?.ai_primary_model
  const hasRequiredKeys = primary === 'groq' ? hasGroq : hasGemini

  return NextResponse.json({ hasRequiredKeys })
  } catch (e) {
    console.error('[KeysStatus GET]', e)
    return NextResponse.json({ error: '설정을 확인하지 못했습니다.' }, { status: 500 })
  }
}
