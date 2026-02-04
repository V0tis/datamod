import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getSupabase } from '@/lib/supabase'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
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
        const supabase = getSupabase()

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: credentials.password,
        })

        if (error || !data?.user) return null

        const user = data.user
        if (!user.email_confirmed_at && user.email) {
          throw new Error(
            '이메일 인증을 먼저 완료해주세요. 가입 시 발송된 확인 링크를 클릭해주세요.'
          )
        }

        return {
          id: user.id,
          email: user.email ?? email,
          name: null,
          image: null,
        }
      },
    }),
    // 이메일 확인 링크(Magic Link) 클릭 시 콜백에서 access_token으로 로그인
    CredentialsProvider({
      id: 'magic-link',
      name: 'Magic Link',
      credentials: {
        access_token: { label: 'Access Token', type: 'text' },
      },
      async authorize(credentials) {
        const token = credentials?.access_token
        if (!token || typeof token !== 'string') return null

        const supabase = getSupabase()
        const { data: { user }, error } = await supabase.auth.getUser(token)

        if (error || !user) return null

        return {
          id: user.id,
          email: user.email ?? '',
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
