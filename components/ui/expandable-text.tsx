'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface ExpandableTextProps {
  text: string
  maxLength?: number
  className?: string
  expandLabel?: string
  collapseLabel?: string
}

export function ExpandableText({
  text,
  maxLength = 150,
  className,
  expandLabel = '더보기',
  collapseLabel = '접기',
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = text.length > maxLength

  return (
    <span className={className}>
      {expanded || !needsTruncation ? text : text.slice(0, maxLength).trim() + '...'}
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="ml-1 text-primary hover:text-primary/80 text-xs font-medium"
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </span>
  )
}
