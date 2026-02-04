import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일을 입력해주세요.' },
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

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: '이미 가입된 이메일입니다.' },
        { status: 400 }
      )
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
          : undefined,
      },
    })

    if (signUpError) {
      if (signUpError.message?.toLowerCase().includes('already registered')) {
        return NextResponse.json(
          { error: '이미 가입된 이메일입니다. 로그인해주세요.' },
          { status: 400 }
        )
      }
      console.error('[signup] Supabase auth.signUp:', signUpError)
      return NextResponse.json(
        { error: signUpError.message || '회원가입 처리에 실패했습니다.' },
        { status: 400 }
      )
    }

    const user = authData.user
    if (!user?.id || !user?.email) {
      return NextResponse.json(
        { error: '회원가입 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    const { error: insertError } = await supabase.from('profiles').insert({
      id: user.id,
      email: user.email,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: '이미 가입된 이메일입니다. 로그인해주세요.' },
          { status: 400 }
        )
      }
      console.error('[signup] profiles insert:', insertError)
      return NextResponse.json(
        { error: '회원가입 처리에 실패했습니다.' },
        { status: 500 }
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
