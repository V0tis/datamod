'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * On small screens, clamp content height and show "전체 보기" to expand. Improves scannability of long insights.
 * On sm and up, no clamp (sm:max-h-none).
 */
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
          !expanded && 'max-h-[20rem] sm:max-h-none',
          className
        )}
      >
        {children}
      </div>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary dark:text-emerald-400 hover:underline sm:hidden"
        >
          {expandLabel}
        </button>
      )}
    </>
  )
}
