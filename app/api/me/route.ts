import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** 현재 사용자 표시용 정보만 반환 (이메일, 닉네임). 키 등 민감 정보 없음. profile.nickname 우선. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('nickname')
    .eq('id', user.id)
    .maybeSingle()

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('nickname')
    .eq('user_id', user.id)
    .maybeSingle()

  const nickname = profile?.nickname ?? settingsRow?.nickname ?? null

  return NextResponse.json({
    email: user.email ?? '',
    nickname,
  })
}
