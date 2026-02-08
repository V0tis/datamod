import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getEffectiveLicenseKeys } from '@/lib/license'

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
    .select('nickname, gemini_api_key, firecrawl_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[Settings GET]', error)
    return NextResponse.json({ error: '설정을 불러오지 못했습니다.' }, { status: 500 })
  }

  const effective = getEffectiveLicenseKeys(row?.gemini_api_key, row?.firecrawl_api_key)
  const hasGeminiKey = !!(row?.gemini_api_key && row.gemini_api_key.trim().length > 0)
  const hasFirecrawlKey = !!(row?.firecrawl_api_key && row.firecrawl_api_key.trim().length > 0)

  return NextResponse.json({
    email: user.email ?? '',
    nickname: row?.nickname ?? '',
    hasGeminiKey,
    hasFirecrawlKey,
    canSearch: effective.canSearch,
    licenseOrigin: {
      gemini: effective.geminiOrigin,
      firecrawl: effective.firecrawlOrigin,
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

  let body: { nickname?: string; gemini_api_key?: string; firecrawl_api_key?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const nickname =
    typeof body.nickname === 'string' ? body.nickname.trim() || null : undefined
  const gemini_api_key =
    typeof body.gemini_api_key === 'string' ? body.gemini_api_key.trim() || null : undefined
  const firecrawl_api_key =
    typeof body.firecrawl_api_key === 'string' ? body.firecrawl_api_key.trim() || null : undefined

  const { data: existing } = await supabase
    .from('user_settings')
    .select('nickname, gemini_api_key, firecrawl_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  const merged = {
    user_id: user.id,
    nickname: nickname !== undefined ? nickname : existing?.nickname ?? null,
    gemini_api_key:
      gemini_api_key !== undefined ? gemini_api_key : existing?.gemini_api_key ?? null,
    firecrawl_api_key:
      firecrawl_api_key !== undefined ? firecrawl_api_key : existing?.firecrawl_api_key ?? null,
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
