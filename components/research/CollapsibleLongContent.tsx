'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Clamp content height by default so key insight stays scannable; expand for full text.
 * Mobile: tighter clamp. Desktop: moderate clamp so first screen isn't dominated by verbose AI text.
 */
const MOBILE_MAX_H = 'max-h-[16rem]'
const DESKTOP_MAX_H = 'md:max-h-[22rem] lg:max-h-none'

export function CollapsibleLongContent({
  children,
  className,
  expandLabel = '전체 분석 보기',
}: {
  children: React.ReactNode
  className?: string
  expandLabel?: string
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div
        className={cn(
          'overflow-hidden',
          !expanded && MOBILE_MAX_H,
          !expanded && DESKTOP_MAX_H,
          className
        )}
      >
        {children}
      </div>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 flex items-center gap-1 min-h-[44px] py-2 text-xs font-medium text-primary dark:text-emerald-400 hover:underline lg:hidden touch-manipulation"
          aria-label={expandLabel}
        >
          {expandLabel}
        </button>
      )}
    </>
  )
}
