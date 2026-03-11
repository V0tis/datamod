import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

export type RequireAuthResult =
  | { user: User; supabase: Awaited<ReturnType<typeof createClient>> }
  | { response: NextResponse }

type RequireAuthOptions = {
  /** Default: '로그인이 필요합니다.' */
  errorMessage?: string
  /** Override 401 response body (e.g. { cached: false, list: [] }) */
  body?: Record<string, unknown>
}

/**
 * Ensures the request is authenticated. Use in API route handlers.
 * @returns { user, supabase } if authenticated, or { response } with 401 to return
 */
export async function requireAuth(
  options: RequireAuthOptions | string = {}
): Promise<RequireAuthResult> {
  const opts = typeof options === 'string' ? { errorMessage: options } : options
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    const body = opts.body ?? { error: opts.errorMessage ?? '로그인이 필요합니다.' }
    return { response: NextResponse.json(body, { status: 401 }) }
  }
  return { user, supabase }
}
