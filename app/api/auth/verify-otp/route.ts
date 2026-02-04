import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

    const otp = await prisma.emailOtp.findFirst({
      where: { email, code, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    })

    if (!otp) {
      return NextResponse.json(
        { error: '인증 코드가 일치하지 않거나 만료되었습니다.' },
        { status: 400 }
      )
    }

    await prisma.emailOtp.delete({ where: { id: otp.id } })

    let user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      user = await prisma.user.create({
        data: { email, emailVerified: new Date() },
      })
    } else if (!user.emailVerified) {
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      })
    }

    const oneTimeToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5분
    await prisma.oneTimeToken.create({
      data: { email, token: oneTimeToken, expiresAt },
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
