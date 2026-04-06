// Next.js App Router용 브라우저 Supabase 클라이언트 (@supabase/ssr)
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Invalid placeholder — avoids throwing during module/init; callers should use isSupabaseBrowserConfigured() first. */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDI2NjE5OTAsImV4cCI6MTk1ODIzNzk5MH0.placeholder'

export function isSupabaseBrowserConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  return Boolean(url && key)
}

/**
 * Browser Supabase client. Does not throw if env is missing (uses placeholder client).
 * Use {@link isSupabaseBrowserConfigured} at app shell level to show a fallback UI instead of a blank screen.
 */
export function createClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || PLACEHOLDER_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || PLACEHOLDER_ANON_KEY
  return createBrowserClient(url, key)
}
