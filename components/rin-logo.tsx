'use client'

import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/** Matches `/public/assets/logo_rin_ai.svg` (keep in sync when replacing the asset). */
export function RinLogoMark({
  className,
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      fill="currentColor"
      aria-hidden
      focusable="false"
      className={cn('shrink-0', className)}
      style={style}
    >
      <path d="M20 3.5 36.5 12v16L20 36.5 3.5 28V12L20 3.5zm0 3.2L6.8 13.4v13.2L20 33.4l13.2-6.8V13.4L20 6.7z" />
      <circle cx="20" cy="20" r="5.5" />
    </svg>
  )
}

export interface RinLogoProps {
  className?: string
  /** Pixel size (square). 생략 시 `h-8 w-8`(32px). */
  size?: number
}

/**
 * rin-ai 브랜드 마크 — 부모에 `text-foreground`, `text-white` 등으로 라이트·다크 대응 (fill=currentColor).
 */
export function RinLogo({ className = '', size }: RinLogoProps) {
  if (size != null) {
    return <RinLogoMark className={className} style={{ width: size, height: size }} />
  }
  return <RinLogoMark className={cn('h-8 w-8', className)} />
}
