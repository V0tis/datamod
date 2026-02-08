'use client'

import { toast } from 'sonner'
import { useErrorDetailStore } from '@/lib/stores/error-detail-store'
import { getFriendlyMessage, formatErrorDetail } from '@/lib/error-handler'

/**
 * 토스트 알림 + "자세히 보기" 버튼 클릭 시 상세 모달 연동.
 * 클라이언트 컴포넌트/훅에서만 사용.
 */
export function showErrorToast(err: unknown, options?: { fallbackMessage?: string }): void {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Dev] Error:', err)
  }
  const friendly = options?.fallbackMessage ?? getFriendlyMessage(err)
  const detail = formatErrorDetail(err)
  toast.error(friendly, {
    description: '자세한 내용은 아래 버튼에서 확인하세요.',
    duration: 6000,
    action: {
      label: '자세히 보기',
      onClick: () => {
        useErrorDetailStore.getState().openDetail(detail)
      },
    },
  })
}
