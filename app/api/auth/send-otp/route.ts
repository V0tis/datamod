import { NextResponse } from 'next/server'

/**
 * @deprecated Supabase Auth 이메일 인증을 사용합니다. 회원가입 시 발송되는 확인 링크로 인증해주세요.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        '이제 이메일 인증은 Supabase 인증 메일의 확인 링크로 진행됩니다. 가입 시 발송된 메일을 확인해주세요.',
    },
    { status: 410 }
  )
}
