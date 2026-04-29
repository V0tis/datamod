'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface GlobalServiceErrorProps {
  title?: string
  description?: string
  onRetry?: () => void
  /** When true, Retry calls window.location.reload() if onRetry omitted */
  retryReloads?: boolean
  className?: string
}

/**
 * 전역 복구 가능 오류 UI (설정 누락·네트워크 등). Datamod는 한국 PM 대상 — 카피는 한국어 기본.
 */
export function GlobalServiceError({
  title = '문제가 발생했습니다',
  description = '서비스를 불러오는 중 오류가 났습니다. 잠시 후 다시 시도하거나 홈으로 이동해 주세요.',
  onRetry,
  retryReloads = true,
  className = '',
}: GlobalServiceErrorProps) {
  const handleRetry = () => {
    if (onRetry) onRetry()
    else if (retryReloads && typeof window !== 'undefined') window.location.reload()
  }

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-background text-foreground ${className}`}
      role="alert"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm p-8 text-center space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="h-7 w-7 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button type="button" onClick={handleRetry} className="w-full sm:w-auto">
            다시 시도
          </Button>
          <Button type="button" variant="secondary" asChild className="w-full sm:w-auto">
            <Link href="/">홈으로</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
