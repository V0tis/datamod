'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, Circle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 'signals', label: '시장 신호 수집', idx: 0 },
  { id: 'trends', label: '검색 트렌드 패턴 분석', idx: 1 },
  { id: 'competition', label: '경쟁 환경 평가', idx: 2 },
  { id: 'score', label: '기회 점수 산출', idx: 3 },
  { id: 'insights', label: '전략적 인사이트 생성', idx: 4 },
] as const

/** Duration per step (ms). Total ~3s for 5 steps. */
const STEP_INTERVAL_MS = 580

export interface AIInsightGenerationSequenceProps {
  keyword?: string
  /** Called when sequence completes and report can be revealed */
  onComplete?: () => void
  /** Total duration before onComplete (ms). Default 3200. */
  durationMs?: number
  className?: string
}

/**
 * AI Insight Generation sequence – shown before revealing the full result report.
 * Creates a stronger "AI thinking" experience (2–4 seconds) before the report appears.
 */
export function AIInsightGenerationSequence({
  keyword = '',
  onComplete,
  durationMs = 3200,
  className,
}: AIInsightGenerationSequenceProps) {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    for (let i = 1; i <= STEPS.length; i++) {
      timers.push(setTimeout(() => setStepIndex(i), i * STEP_INTERVAL_MS))
    }
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      onComplete?.()
    }, durationMs)
    return () => clearTimeout(t)
  }, [durationMs, onComplete])

  return (
    <div
      className={cn(
        'rounded-xl border-2 border-primary/25 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent',
        'p-5 sm:p-6 animate-in fade-in duration-300',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="AI 인사이트 생성 중"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/20">
          <Sparkles className="h-6 w-6 text-primary animate-pulse" aria-hidden />
        </div>
        <div>
          <p className="font-semibold text-foreground">AI 인사이트 생성 중</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            &quot;{keyword || '시장'}&quot; 분석 결과를 정리하고 있습니다
          </p>
        </div>
      </div>

      <ul className="space-y-2.5" aria-label="분석 단계">
        {STEPS.map((step) => {
          const isDone = step.idx < stepIndex
          const isActive = step.idx === stepIndex
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-3 text-sm transition-all duration-300',
                isDone && 'opacity-100',
                isActive && 'opacity-100',
                !isDone && !isActive && 'opacity-50'
              )}
            >
              {isDone ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                </span>
              ) : isActive ? (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" aria-hidden />
                </span>
              ) : (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  <Circle className="h-3 w-3 text-muted-foreground" aria-hidden />
                </span>
              )}
              <span
                className={cn(
                  'font-medium',
                  isDone ? 'text-foreground' : isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
                {isActive && <span className="ml-1 text-primary">중...</span>}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
