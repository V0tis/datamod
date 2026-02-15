'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface LoadingStateProps {
  message: string
  detail?: string
  size?: 'sm' | 'md' | 'lg'
  icon?: React.ReactNode
  className?: string
  live?: boolean
}

const sizeClasses = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-12 h-12' }

export function LoadingState({
  message,
  detail,
  size = 'md',
  icon,
  className,
  live = true,
}: LoadingStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-3 text-center py-8 px-4', className)}
      role={live ? 'status' : undefined}
      aria-live={live ? 'polite' : undefined}
      aria-busy="true"
    >
      {icon ?? (
        <Loader2 className={cn('animate-spin text-muted-foreground', sizeClasses[size])} aria-hidden />
      )}
      <p className="text-sm font-medium text-foreground dark:text-slate-200">{message}</p>
      {detail && <p className="text-xs text-muted-foreground dark:text-slate-500">{detail}</p>}
    </div>
  )
}
