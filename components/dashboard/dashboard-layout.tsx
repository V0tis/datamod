import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 대시보드: 풀너비 요약층 + 2:1 그리드. 섹션 간 여백 넉넉히(≈1.5×).
 */
export function DashboardLayout({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-6 py-8 sm:px-8 min-h-[calc(100vh-3.5rem)] sm:gap-10',
        className
      )}
    >
      {children}
    </div>
  )
}
