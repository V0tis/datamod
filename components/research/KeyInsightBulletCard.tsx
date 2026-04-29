'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Lightbulb, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface KeyInsightBulletCardProps {
  /** Insight text */
  title: string
  /** Optional index badge (1, 2, 3) */
  index?: number
  className?: string
}

/**
 * Card for a single key insight. Max 3 lines preview, expandable detail.
 */
export function KeyInsightBulletCard({
  title,
  index,
  className,
}: KeyInsightBulletCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = title.length > 120

  return (
    <motion.div
      layout={false}
      role={isLong ? 'button' : undefined}
      tabIndex={isLong ? 0 : undefined}
      onClick={() => isLong && setExpanded((e) => !e)}
      onKeyDown={(ev) => {
        if (!isLong) return
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault()
          setExpanded((e) => !e)
        }
      }}
      className={cn(
        'flex gap-3 rounded-lg border border-slate-100 bg-slate-50/80 p-4 shadow-sm transition-transform duration-200  ',
        isLong && 'cursor-pointer hover:-translate-y-1 hover:border-slate-200 hover:shadow-md ',
        className
      )}
    >
      {index != null && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-700   "
          aria-hidden
        >
          {index}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-medium leading-snug text-slate-800 ',
            !expanded && 'line-clamp-3'
          )}
        >
          {title}
        </p>
        {isLong && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-1 mt-2 h-6 text-xs font-medium text-emerald-800 hover:bg-emerald-50  "
            onClick={(e) => {
              e.stopPropagation()
              setExpanded((v) => !v)
            }}
            aria-expanded={expanded}
          >
            {expanded ? (
              <>접기 <ChevronUp className="w-3 h-3 ml-0.5" /></>
            ) : (
              <>자세히 보기 <ChevronDown className="w-3 h-3 ml-0.5" /></>
            )}
          </Button>
        )}
      </div>
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 " aria-hidden />
    </motion.div>
  )
}
