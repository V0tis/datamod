import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * 인증 콜백 후 호출: user_settings에 기존 설정 유지, profiles에 이메일 동기화.
 * DB의 키는 서버에서만 사용하며, 클라이언트에 키를 노출하지 않음.
 */
export async function POST() {
  try {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const verified = Boolean(user?.email_confirmed_at)

  const { data: existing } = await supabase
    .from('user_settings')
    .select('gemini_api_key, groq_api_key, serper_api_key')
    .eq('user_id', user.id)
    .maybeSingle()

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      gemini_api_key: existing?.gemini_api_key ?? null,
      groq_api_key: existing?.groq_api_key ?? null,
      serper_api_key: existing?.serper_api_key ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    console.error('[sync-profile]', error)
    return NextResponse.json({ error: '프로필 동기화에 실패했습니다.' }, { status: 500 })
  }

  await supabase
    .from('profiles')
    .upsert(
      { id: user.id, email: user.email ?? '' },
      { onConflict: 'id' }
    )

  return NextResponse.json({ success: true, verified })
  } catch (e) {
    console.error('[sync-profile]', e)
    return NextResponse.json({ error: '프로필 동기화에 실패했습니다.' }, { status: 500 })
  }
}
