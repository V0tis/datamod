import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/** 인증 없이 접근 가능한 경로 (로그인/회원가입/공유 등). 그 외 모든 페이지는 로그인 필요. */
const PUBLIC_PATHS = [
  '/login',
  '/auth/login',
  '/auth/signup',
  '/auth/verify',
  '/auth/verify-email',
  '/auth/callback',
]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')))
    return true
  if (pathname.startsWith('/share/')) return true
  return false
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return NextResponse.next()

  const response = NextResponse.next({ request })

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  // 세션/토큰은 쿠키로 유지되며 getUser()가 유효성 검사. 새로고침 시에도 인증 상태 유지.
  if (isPublicPath(pathname)) return response
  if (pathname.startsWith('/api/')) return response

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname + request.nextUrl.search)
    loginUrl.searchParams.set('reason', 'login_required')
    return NextResponse.redirect(loginUrl)
  }

  // 이메일 미인증 사용자: 인증 요청 페이지로 리다이렉트
  if (!user.email_confirmed_at) {
    const verifyUrl = new URL('/auth/verify-email', request.url)
    verifyUrl.searchParams.set('reason', 'email_verification_required')
    return NextResponse.redirect(verifyUrl)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|svg|jpg|jpeg|gif|webp)$).*)'],
}
