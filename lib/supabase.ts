import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and Supabase key are required.')
    _client = createClient(url, key)
  }
  return _client
}

export type UserStatus = 'pending_verification' | 'verified'

export interface AuthUser {
  id: string
  email: string
  password_hash: string
  status: UserStatus
  otp_code: string | null
  otp_expires_at: string | null
  created_at: string
  updated_at: string
}
