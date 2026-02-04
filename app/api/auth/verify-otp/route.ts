import { NextResponse } from 'next/server'

/**
 * @deprecated Supabase Auth 이메일 인증을 사용합니다. 확인 링크 클릭 후 로그인해주세요.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        '이제 이메일 인증은 Supabase 인증 메일의 확인 링크로 진행됩니다. 링크를 클릭한 뒤 로그인해주세요.',
    },
    { status: 410 }
  )
}
