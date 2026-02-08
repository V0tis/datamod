import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** 현재 사용자 표시용 정보만 반환 (이메일, 닉네임). 키 등 민감 정보 없음. */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: row } = await supabase
    .from('user_settings')
    .select('nickname')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    email: user.email ?? '',
    nickname: row?.nickname ?? null,
  })
}
