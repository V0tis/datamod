'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const shimmerClass = 'animate-skeleton-shimmer'

const container = {
  hidden: { opacity: 0.85 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const item = {
  hidden: { opacity: 0.5, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
}

interface SectionContentSkeletonProps {
  variant?: 'grid' | 'list' | 'mixed' | 'chart'
  className?: string
}

/**
 * Skeleton UI for pending analysis sections (Progressive Result UX).
 * Shimmer animation indicates loading; reduces perceived wait time.
 */
export function SectionContentSkeleton({ variant = 'grid', className }: SectionContentSkeletonProps) {
  if (variant === 'grid') {
    return (
      <motion.div
        className={cn('grid grid-cols-1 sm:grid-cols-3 gap-3', className)}
        variants={container}
        initial="hidden"
        animate="show"
      >
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            variants={item}
            className={cn('h-20 rounded-lg', shimmerClass)}
            aria-hidden
            role="presentation"
          />
        ))}
      </motion.div>
    )
  }
  if (variant === 'list') {
    return (
      <motion.div className={cn('space-y-3', className)} variants={container} initial="hidden" animate="show">
        {[1, 2, 3, 4].map((i) => (
          <motion.div key={i} variants={item} className="flex gap-3">
            <div className={cn('h-4 w-4 shrink-0 rounded-full', shimmerClass)} aria-hidden role="presentation" />
            <div
              className={cn('flex-1 h-5 rounded', shimmerClass)}
              style={{ width: `${60 + (i % 3) * 15}%` }}
              aria-hidden
              role="presentation"
            />
          </motion.div>
        ))}
      </motion.div>
    )
  }
  if (variant === 'chart') {
    return (
      <motion.div
        className={cn('space-y-4', className)}
        variants={container}
        initial="hidden"
        animate="show"
      >
        <div className="flex justify-between gap-4">
          <div className={cn('h-4 w-24 rounded', shimmerClass)} aria-hidden role="presentation" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className={cn('h-6 w-12 rounded', shimmerClass)} aria-hidden role="presentation" />
            ))}
          </div>
        </div>
        <motion.div
          variants={item}
          className="h-[200px] rounded-lg border border-border/40 flex items-end gap-2 px-4 pb-4 pt-8"
        >
          {[40, 65, 45, 80, 55, 70, 50].map((h, i) => (
            <motion.div
              key={i}
              className={cn('flex-1 rounded-t origin-bottom', shimmerClass)}
              style={{ height: `${h}%` }}
              initial={{ scaleY: 0.65, opacity: 0.6 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const }}
              aria-hidden
              role="presentation"
            />
          ))}
        </motion.div>
        <div className="flex gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={cn('h-3 w-3 rounded-full', shimmerClass)} aria-hidden role="presentation" />
              <div className={cn('h-4 w-16 rounded', shimmerClass)} aria-hidden role="presentation" />
            </div>
          ))}
        </div>
      </motion.div>
    )
  }
  /* mixed */
  return (
    <motion.div className={cn('space-y-3', className)} variants={container} initial="hidden" animate="show">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1, 2].map((i) => (
          <motion.div
            key={i}
            variants={item}
            className={cn('h-16 rounded-lg', shimmerClass)}
            aria-hidden
            role="presentation"
          />
        ))}
      </div>
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <motion.div
            key={i}
            variants={item}
            className={cn('h-4 rounded', shimmerClass)}
            style={{ width: `${70 + i * 5}%` }}
            aria-hidden
            role="presentation"
          />
        ))}
      </div>
    </motion.div>
  )
}
