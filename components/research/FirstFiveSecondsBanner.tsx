'use client'

import { useState, useEffect } from 'react'
import { Loader2, Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

const EARLY_STEPS = [
  { id: 'input', label: '사용자 입력 분석', idx: 0 },
  { id: 'collect', label: '시장 데이터 수집', idx: 1 },
  { id: 'trend', label: '트렌드 신호 탐색', idx: 2 },
  { id: 'comp', label: '경쟁 분석 준비', idx: 3 },
  { id: 'strategy', label: '전략 분석 준비', idx: 4 },
] as const

export interface FirstFiveSecondsBannerProps {
  keyword?: string
  /** When true, show the early micro insight (after ~2s) */
  showMicroInsight?: boolean
  className?: string
}

/**
 * First 5 Seconds UX – instant feedback when analysis starts.
 * Shows "AI 분석 시작됨", animated steps, and early micro insight.
 */
export function FirstFiveSecondsBanner({
  keyword = '',
  showMicroInsight = true,
  className,
}: FirstFiveSecondsBannerProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [microInsightVisible, setMicroInsightVisible] = useState(false)

  useEffect(() => {
    setStepIndex(0)
    setMicroInsightVisible(false)
  }, [keyword])

  useEffect(() => {
    const t1 = setTimeout(() => setStepIndex(1), 400)
    const t2 = setTimeout(() => setStepIndex(2), 1200)
    const t3 = setTimeout(() => setStepIndex(3), 2200)
    const t4 = setTimeout(() => setStepIndex(4), 3200)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [])

  useEffect(() => {
    if (!showMicroInsight) return
    const t = setTimeout(() => setMicroInsightVisible(true), 2000)
    return () => clearTimeout(t)
  }, [showMicroInsight])

  return (
    <div
      className={cn(
        'rounded-xl border border-primary/30 bg-gradient-to-br from-primary/8 via-primary/5 to-transparent',
        'p-4 sm:p-5 flex flex-col sm:flex-row gap-4 animate-in fade-in duration-200',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label="AI 분석 시작됨"
    >
      <div className="flex items-start gap-3 shrink-0">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
        </div>
        <div>
          <p className="font-semibold text-foreground">AI 분석 시작됨</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            시장 데이터를 수집하고 있습니다...
          </p>
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          AI가 시장 데이터를 분석하고 있습니다
        </p>
        <ul className="space-y-1.5">
          {EARLY_STEPS.map((step) => {
            const isDone = step.idx === 0 || step.idx < stepIndex
            const isActive = step.idx === stepIndex || (step.idx === 1 && stepIndex === 0)
            return (
              <li
                key={step.id}
                className={cn(
                  'flex items-center gap-2 text-sm transition-opacity duration-300',
                  isDone || isActive ? 'opacity-100' : 'opacity-60'
                )}
              >
                {isDone ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={isDone ? 'text-foreground' : 'text-muted-foreground'}>
                  {step.label}
                  {isActive && <span className="ml-1 text-primary">중</span>}
                </span>
              </li>
            )
          })}
        </ul>

        {microInsightVisible && (
          <div
            className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 animate-in fade-in slide-in-from-bottom-1 duration-300"
            role="status"
          >
            <p className="text-[11px] font-medium text-primary uppercase tracking-wider mb-0.5">
              초기 신호 탐색
            </p>
            <p className="text-sm text-foreground">
              &quot;{keyword || '시장'}&quot; 관련 데이터를 수집하고 있습니다. 곧 인사이트가 표시됩니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
