import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null
    const code = typeof body?.code === 'string' ? body.code.trim() : ''

    if (!email || !code) {
      return NextResponse.json(
        { error: '이메일과 인증 코드를 입력해주세요.' },
        { status: 400 }
      )
    }

    const { data: user, error: fetchError } = await getSupabase()
      .from('auth_users')
      .select('id, otp_code, otp_expires_at')
      .eq('email', email)
      .single()

    if (fetchError || !user) {
      return NextResponse.json(
        { error: '가입된 이메일이 없습니다.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    if (!user.otp_code || user.otp_code !== code || !user.otp_expires_at || user.otp_expires_at < now) {
      return NextResponse.json(
        { error: '인증 코드가 일치하지 않거나 만료되었습니다. (5분 내에 입력해주세요.)' },
        { status: 400 }
      )
    }

    const { error: updateError } = await getSupabase()
      .from('auth_users')
      .update({
        status: 'verified',
        otp_code: null,
        otp_expires_at: null,
        updated_at: now,
      })
      .eq('email', email)

    if (updateError) {
      console.error('[verify-otp] update:', updateError)
      return NextResponse.json(
        { error: '인증 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    const oneTimeToken = crypto.randomBytes(32).toString('hex')
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    await getSupabase().from('one_time_tokens').insert({
      email,
      token: oneTimeToken,
      expires_at,
    })

    return NextResponse.json({
      ok: true,
      token: oneTimeToken,
      email,
      message: '인증이 완료되었습니다. 로그인합니다.',
    })
  } catch (e) {
    console.error('[verify-otp]', e)
    return NextResponse.json(
      { error: '인증 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
