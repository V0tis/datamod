import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * 대시보드: max-width 1280px, 좌우 24px, 섹션 간 32px.
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
        'mx-auto flex w-full max-w-[1280px] flex-col gap-8 px-6 py-8 min-h-[calc(100vh-3.5rem)]',
        className
      )}
    >
      {children}
    </div>
  )
}
