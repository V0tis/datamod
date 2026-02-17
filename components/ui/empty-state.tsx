'use client'

import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  title: string
  description: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, action, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn('flex flex-col items-center justify-center text-center py-8 px-4 max-w-md mx-auto', className)}
      role="status"
    >
      {icon && (
        <div className="mb-4 text-muted-foreground [&_svg]:w-12 [&_svg]:h-12">
          {icon}
        </div>
      )}
      <h2 className="text-base font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      {action}
    </div>
  )
}
