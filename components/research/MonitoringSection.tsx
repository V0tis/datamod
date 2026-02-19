'use client'

import { Square } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MonitoringSectionProps {
  items: string[]
  className?: string
}

export function MonitoringSection({ items, className }: MonitoringSectionProps) {
  if (!items?.length) return null

  return (
    <section className={cn('space-y-2', className)}>
      <h3 className="text-sm font-semibold text-foreground">Things to Watch</h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Square className="mt-0.5 h-3.5 w-3.5 shrink-0 stroke-[2] text-muted-foreground/70" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
