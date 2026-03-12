'use client'

import { ErrorBoundary } from '@/components/error-boundary'

interface ResultSectionErrorBoundaryProps {
  children: React.ReactNode
  sectionName: string
  fallbackTitle?: string
}

/**
 * Section-level error boundary for result page.
 * Shows compact fallback so the rest of the page remains usable.
 */
export function ResultSectionErrorBoundary({
  children,
  sectionName,
  fallbackTitle = '이 섹션을 불러오지 못했습니다',
}: ResultSectionErrorBoundaryProps) {
  return (
    <ErrorBoundary
      sectionName={sectionName}
      compact
      fallbackTitle={fallbackTitle}
      fallbackMessage="다시 시도하거나 페이지를 새로고침해 주세요."
    >
      {children}
    </ErrorBoundary>
  )
}
