'use client'

import { cn } from '@/lib/utils'

const LEVEL_CLASS: Record<0 | 1 | 2, string> = {
  0: 'border-[var(--color-destructive)] bg-[color-mix(in_srgb,var(--color-destructive)_10%,var(--color-background))] text-[var(--color-destructive)]',
  1: 'border-[var(--color-warning)] bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-background))] text-[color-mix(in_srgb,var(--color-warning)_85%,var(--color-foreground))]',
  2: 'border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
}

const SIZE: Record<'sm' | 'md', string> = {
  sm: 'px-1.5 py-0.5 text-[10px] min-w-[2rem] justify-center',
  md: 'px-2.5 py-1 text-xs min-w-[2.25rem] justify-center',
}

export function PriorityBadge({ level, size = 'md' }: { level: 0 | 1 | 2; size?: 'sm' | 'md' }) {
  const label = level === 0 ? 'P0' : level === 1 ? 'P1' : 'P2'
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border font-bold tabular-nums tracking-tight',
        LEVEL_CLASS[level],
        SIZE[size]
      )}
    >
      {label}
    </span>
  )
}

export function urgencyToPLevel(p?: 'high' | 'medium' | 'low'): 0 | 1 | 2 {
  if (p === 'high') return 0
  if (p === 'low') return 2
  return 1
}
