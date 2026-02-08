import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 인증 콜백 후 호출: user_metadata.nickname을 user_settings에 저장.
 * DB의 키는 서버에서만 사용하며, 클라이언트에 키를 노출하지 않음.
 */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nickname =
    typeof user.user_metadata?.nickname === 'string'
      ? user.user_metadata.nickname.trim() || null
      : null

  const { data: existing } = await supabase
    .from('user_settings')
    .select('nickname, gemini_api_key, firecrawl_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      nickname: nickname ?? existing?.nickname ?? null,
      gemini_api_key: existing?.gemini_api_key ?? null,
      firecrawl_api_key: existing?.firecrawl_api_key ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[sync-profile]', error)
    return NextResponse.json({ error: '프로필 동기화에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
