'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { RinLogo } from '@/components/rin-logo'
import { cn } from '@/lib/utils'

export function AuthPageShell({
  children,
  subtitle = 'AI 기반 시장 리서치 도구',
  tagline,
  className,
}: {
  children: ReactNode
  /** 한 줄 제품 정의 (muted) */
  subtitle?: string
  /** 보조 한 줄 (Outcome-focused, optional) */
  tagline?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'min-h-screen flex flex-col items-center justify-center px-4 py-12',
        'bg-muted/40 text-foreground',
        className
      )}
    >
      <div className="w-full max-w-[400px] space-y-6">
        <header className="text-center space-y-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="홈으로 이동"
          >
            <RinLogo size={28} className="shrink-0" />
            <span className="text-xl font-semibold tracking-tight text-foreground">RIN-AI</span>
          </Link>
          <p className="text-sm font-medium text-foreground">{subtitle}</p>
          {tagline ? (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">{tagline}</p>
          ) : null}
        </header>
        <div className="rounded-xl border border-border bg-card shadow-sm">{children}</div>
      </div>
    </div>
  )
}
