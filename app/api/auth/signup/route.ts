import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

const ALREADY_REGISTERED_MESSAGE = '이미 등록된 이메일입니다. 로그인해 주세요.'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const nickname = typeof body?.nickname === 'string' ? body.nickname.trim() : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!nickname) {
      return NextResponse.json(
        { error: '닉네임을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: '비밀번호는 최소 8자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    // 1. auth.signUp 호출 전 반드시 profiles에서 이메일 존재 여부 조회 (중복 가입 차단)
    const { data: existingByEmail } = await supabase
      .from('profiles')
      .select('email')
      .eq('email', email)
      .maybeSingle()

    if (existingByEmail) {
      // 이미 존재하면 절대 signUp 실행하지 않고 에러만 반환
      return NextResponse.json(
        { error: ALREADY_REGISTERED_MESSAGE },
        { status: 400 }
      )
    }

    // 2. 존재하지 않을 때만 확인 메일을 보내기 위해 signUp 실행 (닉네임은 user_metadata에 저장, 인증 후 sync-profile에서 user_settings로 복사)
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nickname },
        emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
          : undefined,
      },
    })

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        return NextResponse.json(
          { error: ALREADY_REGISTERED_MESSAGE },
          { status: 400 }
        )
      }
      console.error('[signup] Supabase auth.signUp:', signUpError)
      return NextResponse.json(
        { error: signUpError.message || '회원가입 처리에 실패했습니다.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      ok: true,
      message:
        '가입되었습니다. 이메일로 전송된 확인 링크를 클릭해 인증을 완료한 뒤 로그인해주세요.',
    })
  } catch (e) {
    console.error('[signup]', e)
    return NextResponse.json(
      { error: '회원가입 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
