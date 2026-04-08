'use client'

import { Loader2 } from 'lucide-react'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'

type FullPageBrandLoaderProps = {
  /** 기본: 화면 중앙 전체 높이 */
  className?: string
  message?: string
  /** 로고 크기(px). 기본 32 (`h-8`). */
  logoSize?: number
}

/** 전역 로딩·Suspense 등: 브랜드 마크 + 스피너 통일 */
export function FullPageBrandLoader({
  className,
  message,
  logoSize,
}: FullPageBrandLoaderProps) {
  return (
    <div
      className={cn(
        'flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4',
        className
      )}
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <RinLogo
        size={logoSize}
        className="text-foreground"
      />
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
      {message ? (
        <p className="text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  )
}
