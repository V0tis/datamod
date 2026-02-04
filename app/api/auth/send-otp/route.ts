import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Rin-AI <onboarding@resend.dev>'

const OTP_EXPIRES_MINUTES = 10
const OTP_LENGTH = 6

function generateOtp(): string {
  const digits = '0123456789'
  let code = ''
  for (let i = 0; i < OTP_LENGTH; i++) {
    code += digits[Math.floor(Math.random() * 10)]
  }
  return code
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : null

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일을 입력해주세요.' },
        { status: 400 }
      )
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: '이메일 발송 설정이 되어 있지 않습니다.' },
        { status: 500 }
      )
    }

    const code = generateOtp()
    const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000)

    await prisma.emailOtp.deleteMany({ where: { email } })
    await prisma.emailOtp.create({
      data: { email, code, expiresAt },
    })

    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Rin-AI 이메일 인증 코드',
      html: `
        <p>Rin-AI 이메일 인증 코드입니다.</p>
        <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>
        <p>${OTP_EXPIRES_MINUTES}분 내에 입력해주세요. 요청하지 않으셨다면 무시해주세요.</p>
      `,
    })

    return NextResponse.json({ ok: true, message: '인증 코드가 발송되었습니다.' })
  } catch (e) {
    console.error('[send-otp]', e)
    return NextResponse.json(
      { error: '인증 코드 발송에 실패했습니다.' },
      { status: 500 }
    )
  }
}
