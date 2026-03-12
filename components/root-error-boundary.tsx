'use client'

import { ErrorBoundary } from '@/components/error-boundary'

/**
 * Root-level ErrorBoundary to prevent full app crash.
 * Catches render errors in AppShell, providers, and their children.
 */
export function RootErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      sectionName="root"
      fallbackTitle="앱 로드 중 오류가 발생했습니다"
      fallbackMessage="새로고침하거나 잠시 후 다시 시도해 주세요."
    >
      {children}
    </ErrorBoundary>
  )
}
