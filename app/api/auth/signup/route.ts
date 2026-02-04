import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'
import { Resend } from 'resend'
import bcrypt from 'bcryptjs'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Rin-AI <onboarding@resend.dev>'

const OTP_EXPIRES_MINUTES = 5
const OTP_LENGTH = 6
const SALT_ROUNDS = 10

function generateOtp(): string {
  let code = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += Math.floor(Math.random() * 10).toString()
  }
  return code
}

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

    const { data: existing } = await getSupabase()
      .from('auth_users')
      .select('id')
      .eq('email', email)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: '이미 가입된 이메일입니다. 로그인해주세요.' },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: '이메일 발송 설정이 되어 있지 않습니다.' },
        { status: 500 }
      )
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS)
    const code = generateOtp()
    const otp_expires_at = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString()

    const { error: insertError } = await getSupabase().from('auth_users').insert({
      email,
      password_hash,
      status: 'pending_verification',
      otp_code: code,
      otp_expires_at,
      updated_at: new Date().toISOString(),
    })

    if (insertError) {
      console.error('[signup] Supabase insert:', insertError)
      return NextResponse.json(
        { error: '회원가입 처리에 실패했습니다.' },
        { status: 500 }
      )
    }

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Rin-AI 이메일 인증 코드',
      html: `
        <p>린(Rin)이 보낸 인증 코드입니다 🐕</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
        <p>${OTP_EXPIRES_MINUTES}분 내에 입력해주세요. 요청하지 않으셨다면 무시해주세요.</p>
      `,
    })

    return NextResponse.json({
      ok: true,
      message: '가입되었습니다. 이메일로 전송된 인증 코드를 입력해주세요.',
    })
  } catch (e) {
    console.error('[signup]', e)
    return NextResponse.json(
      { error: '회원가입 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
