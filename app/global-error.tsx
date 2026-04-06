'use client'

import { GlobalServiceError } from '@/components/errors/global-service-error'

/**
 * Root-level error UI when the root layout fails. Must define its own <html>/<body>.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <GlobalServiceError
          title="서비스를 불러오지 못했습니다"
          description={
            error?.message?.includes('Supabase') || error?.message?.includes('NEXT_PUBLIC')
              ? '서비스 설정(Supabase·환경 변수)에 문제가 있을 수 있습니다. 배포 설정을 확인한 뒤 다시 시도해 주세요.'
              : '앱을 불러오는 중 오류가 발생했습니다. 새로고침하거나 잠시 후 다시 시도해 주세요.'
          }
          retryReloads
        />
      </body>
    </html>
  )
}
