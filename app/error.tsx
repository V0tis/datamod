'use client'

import { useEffect } from 'react'
import { GlobalServiceError } from '@/components/errors/global-service-error'
import { logger } from '@/lib/logger'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('app/error.tsx', {
      message: error?.message,
      digest: error?.digest,
      stack: error?.stack,
    })
  }, [error])

  return (
    <GlobalServiceError
      title="페이지를 불러오지 못했습니다"
      description="이 페이지를 여는 중 문제가 발생했습니다. 다시 시도하거나 홈 화면으로 돌아가 주세요."
      onRetry={() => reset()}
      retryReloads={false}
    />
  )
}
