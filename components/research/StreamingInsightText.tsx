'use client'

import { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { inferRiskSeverity, type RiskSeverity } from '@/lib/risk-severity'

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
          <span>{sanitizeForKoreanDisplay(item) || item}</span>
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

const RISK_BADGE: Record<
  RiskSeverity,
  { label: string; dot: string; ring: string }
> = {
  high: { label: 'High', dot: 'bg-[#FF5F5F]', ring: 'border-[#FF5F5F]/35 bg-[#FF5F5F]/10' },
  medium: { label: 'Medium', dot: 'bg-amber-400', ring: 'border-amber-400/40 bg-amber-400/10' },
  low: { label: 'Low', dot: 'bg-[#2AC1BC]', ring: 'border-[#2AC1BC]/35 bg-[#2AC1BC]/10' },
}

function RiskSeverityBadge({ level }: { level: RiskSeverity }) {
  const b = RISK_BADGE[level]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        b.ring
      )}
      title={`위험도: ${b.label}`}
    >
      <span className={cn('h-2 w-2 rounded-full', b.dot)} aria-hidden />
      {b.label}
    </span>
  )
}

/** 리스크 평가용: 문장 옆 High/Medium/Low 신호등 배지 */
export function StreamingRiskList({
  items,
  streaming = false,
  revealDelayMs = 300,
  skipAnimation = false,
  className,
}: {
  items: string[]
  streaming?: boolean
  revealDelayMs?: number
  skipAnimation?: boolean
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

  const streamingPartial = streaming && revealedCount < items.length
  const showCursor = streaming && revealedCount > 0

  if (items.length === 0) return null

  return (
    <ul className={cn('space-y-2 list-none pl-0', className)}>
      {items.slice(0, revealedCount).map((raw, i) => {
        const item = repairMultilingualText(raw) || sanitizeForKoreanDisplay(raw) || raw
        const level = inferRiskSeverity(item)
        return (
          <li
            key={i}
            className="flex gap-3 rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5 text-sm text-foreground animate-in fade-in slide-in-from-bottom-1 duration-150"
          >
            <RiskSeverityBadge level={level} />
            <span className="min-w-0 flex-1 leading-relaxed">{item}</span>
          </li>
        )
      })}
      {streamingPartial && showCursor && (
        <li className="flex gap-3 items-center rounded-lg border border-dashed border-border/60 px-3 py-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/30 animate-pulse" aria-hidden />
          <span className="flex items-center gap-1">
            AI 분석 생성중...
            <StreamingCursor />
          </span>
        </li>
      )}
    </ul>
  )
}

