'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Blinking cursor shown while streaming */
function StreamingCursor({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block w-0.5 h-4 align-middle bg-primary animate-pulse ml-0.5', className)}
      aria-hidden
    />
  )
}

/** Reveals a list of bullet strings one-by-one with streaming effect */
export function StreamingBulletList({
  items,
  streaming = false,
  revealDelayMs = 300,
  skipAnimation = false,
  variant = 'default',
  className,
}: {
  items: string[]
  streaming?: boolean
  revealDelayMs?: number
  skipAnimation?: boolean
  /** 'risk' for red bullets (리스크 평가) */
  variant?: 'default' | 'risk'
  className?: string
}) {
  const [revealedCount, setRevealedCount] = useState(0)
  const prevKey = useRef('')
  const key = items.join('|')

  useEffect(() => {
    if (items.length === 0) {
      setRevealedCount(0)
      return
    }
    if (key !== prevKey.current) {
      prevKey.current = key
      setRevealedCount(0)
    }
  }, [key, items.length])

  useEffect(() => {
    if (skipAnimation || !streaming || items.length === 0) {
      setRevealedCount(items.length)
      return
    }
    if (revealedCount >= items.length) return
    const t = setTimeout(() => setRevealedCount((c) => Math.min(c + 1, items.length)), revealDelayMs)
    return () => clearTimeout(t)
  }, [revealedCount, items.length, streaming, revealDelayMs, skipAnimation])

  const isStreaming = streaming && revealedCount < items.length
  const showCursor = streaming && revealedCount > 0

  if (items.length === 0) return null

  const bulletCls = variant === 'risk' ? 'text-destructive' : 'text-primary'
  return (
    <ul className={cn('space-y-1.5 list-none pl-0', className)}>
      {items.slice(0, revealedCount).map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-foreground animate-in fade-in slide-in-from-bottom-1 duration-150">
          <span className={cn('shrink-0', bulletCls)}>•</span>
          <span>{item}</span>
        </li>
      ))}
      {showCursor && (
        <li className="flex gap-2 text-sm text-muted-foreground items-center">
          <span className={cn('shrink-0', bulletCls)}>•</span>
          <span className="flex items-center gap-1">
            AI 분석 생성중...
            <StreamingCursor />
          </span>
        </li>
      )}
    </ul>
  )
}

/** Status badge for section: streaming vs complete */
export function StreamingSectionStatus({
  streaming,
  complete,
  className,
}: {
  streaming?: boolean
  complete?: boolean
  className?: string
}) {
  if (complete) {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs font-medium text-primary', className)}>
        <span aria-hidden>✓</span> 생성 완료
      </span>
    )
  }
  if (streaming) {
    return (
      <span className={cn('flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" aria-hidden />
        생성중...
      </span>
    )
  }
  return null
}
