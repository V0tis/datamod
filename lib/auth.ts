import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getSupabase } from '@/lib/supabase'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    // 이메일 + 비밀번호 로그인 (인증된 유저만)
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email.trim().toLowerCase()
        const { data: user, error } = await getSupabase()
          .from('auth_users')
          .select('id, email, password_hash, status')
          .eq('email', email)
          .single()

        if (error || !user) return null
        if (user.status !== 'verified') {
          throw new Error('이메일 인증을 먼저 완료해주세요.')
        }

        const ok = await bcrypt.compare(credentials.password, user.password_hash)
        if (!ok) return null

        return {
          id: user.id,
          email: user.email,
          name: null,
          image: null,
        }
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

        const email = credentials.email.trim().toLowerCase()
        const now = new Date().toISOString()

        const { data: row } = await getSupabase()
          .from('one_time_tokens')
          .select('id')
          .eq('email', email)
          .eq('token', credentials.token)
          .gt('expires_at', now)
          .limit(1)
          .single()

        if (!row) return null

        await getSupabase().from('one_time_tokens').delete().eq('id', row.id)

        const { data: user } = await getSupabase()
          .from('auth_users')
          .select('id, email')
          .eq('email', email)
          .single()

        if (!user) return null

        return {
          id: user.id,
          email: user.email,
          name: null,
          image: null,
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id
        token.email = user.email ?? undefined
      }
      return token
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
}
