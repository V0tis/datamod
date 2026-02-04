import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) {
      const missing = [
        !url && 'NEXT_PUBLIC_SUPABASE_URL',
        !key && '(SUPABASE_SERVICE_ROLE_KEY 또는 NEXT_PUBLIC_SUPABASE_ANON_KEY)',
      ].filter(Boolean)
      throw new Error(
        `Supabase 환경 변수가 없습니다: ${missing.join(', ')}. ` +
          `.env.local 수정 후 Next.js 서버를 재시작했는지 확인하세요.`
      )
    }
    _client = createClient(url, key)
  }
  return _client
}

export interface Profile {
  id: string
  email: string
}
