import type { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import EmailProvider from 'next-auth/providers/email'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL = process.env.EMAIL_FROM ?? 'Rin-AI <onboarding@resend.dev>'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/login',
    verifyRequest: '/auth/verify',
    error: '/auth/login',
  },
  providers: [
    // Magic Link: Resend로 이메일 발송
    EmailProvider({
      server: {},
      from: FROM_EMAIL,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await resend.emails.send({
          from: FROM_EMAIL,
          to: email,
          subject: 'Rin-AI 로그인 링크',
          html: `
            <p>Rin-AI 로그인을 위해 아래 버튼을 클릭해주세요.</p>
            <p><a href="${url}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:8px;">로그인하기</a></p>
            <p>링크는 24시간 동안 유효합니다.</p>
            <p>요청하지 않으셨다면 이 메일을 무시해주세요.</p>
          `,
        })
      },
    }),
    // OTP 인증 후 일회용 토큰으로 로그인
    CredentialsProvider({
      id: 'otp',
      name: 'OTP',
      credentials: {
        email: { label: 'Email', type: 'email' },
        token: { label: 'Token', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.token) return null
        const oneTime = await prisma.oneTimeToken.findFirst({
          where: {
            email: credentials.email,
            token: credentials.token,
            expiresAt: { gt: new Date() },
          },
        })
        if (!oneTime) return null
        await prisma.oneTimeToken.delete({ where: { id: oneTime.id } })
        let user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: credentials.email,
              emailVerified: new Date(),
            },
          })
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          emailVerified: user.emailVerified,
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.email = user.email ?? undefined
        token.emailVerified =
          (user as { emailVerified?: Date }).emailVerified ?? new Date()
      }
      return token
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.emailVerified = token.emailVerified as Date | undefined
      }
      return session
    },
  },
  events: {
    createUser: async ({ user }) => {
      if (user.email) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        })
      }
    },
  },
}
