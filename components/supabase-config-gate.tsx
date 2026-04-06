'use client'

import { GlobalServiceError } from '@/components/errors/global-service-error'
import { isSupabaseBrowserConfigured } from '@/lib/supabase/client'

/**
 * Prevents blank screen when Supabase env vars are missing at build/runtime.
 */
export function SupabaseConfigGate({ children }: { children: React.ReactNode }) {
  if (!isSupabaseBrowserConfigured()) {
    return (
      <GlobalServiceError
        title="서비스 설정이 필요합니다"
        description="Supabase 연결 정보가 없습니다. NEXT_PUBLIC_SUPABASE_URL과 NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수를 확인한 뒤 다시 시도해 주세요."
        retryReloads
      />
    )
  }
  return <>{children}</>
}
