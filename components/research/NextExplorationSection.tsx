'use client'

import { useState } from 'react'
import { Sparkles, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** 관련 시장 키워드 제안 */
const RELATED_MARKET_IDEAS = [
  'HR 자동화 AI 도구',
  'AI 영업 지원 플랫폼',
  'AI 법률 서비스',
  'AI 마케팅 자동화',
  'AI 고객 응대 솔루션',
  'AI 문서 분석 도구',
] as const

export interface NextExplorationSectionProps {
  /** Called when user selects a suggested keyword */
  onSelectKeyword: (keyword: string) => void
  /** Called when user runs analysis on a new keyword from input */
  onRunAnalysis: (keyword: string) => void
  /** Follow-up Q&A: same keyword, ask more. Shown as primary when provided. */
  followUp?: {
    value: string
    onChange: (v: string) => void
    onSubmit: () => void
    loading?: boolean
    disabled?: boolean
    placeholder?: string
  }
  disabled?: boolean
  className?: string
}

/**
 * Next Exploration – encourages further analysis after reading results.
 * - Related Market Ideas: suggested keywords
 * - Run Another Analysis: input to analyze a new market
 */
export function NextExplorationSection({
  onSelectKeyword,
  onRunAnalysis,
  followUp,
  disabled = false,
  className,
}: NextExplorationSectionProps) {
  const [inputValue, setInputValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const keyword = inputValue.trim()
    if (!keyword || disabled) return
    onRunAnalysis(keyword)
    setInputValue('')
  }

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    followUp?.onSubmit()
  }

  return (
    <section
      className={cn(
        'mt-16 pt-8 border-t border-border/60',
        className
      )}
      aria-label="다음 탐색"
    >
      <div className="rounded-xl border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-5 sm:p-6">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-primary" />
          다음 탐색
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          {followUp ? '동일 키워드로 추가 질문하거나, 다른 시장을 분석해 보세요.' : '다른 시장 아이디어를 분석해 보세요.'}
        </p>

        <div className="space-y-6">
          {/* 1. Follow-up Q&A (primary when available) */}
          {followUp && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                같은 키워드로 추가 질문
              </p>
              <form onSubmit={handleFollowUpSubmit} className="flex gap-2">
                <Input
                  type="text"
                  placeholder={followUp.placeholder ?? '예: 이 시장에서 경쟁 우위를 얻으려면?'}
                  value={followUp.value ?? ''}
                  onChange={(e) => followUp.onChange(e.target.value)}
                  disabled={followUp.loading}
                  autoComplete="off"
                  className="flex-1"
                  aria-label="추가 질문"
                />
                <Button
                  type="submit"
                  disabled={followUp.loading || !(followUp.value ?? '').trim()}
                  className="gap-1.5 shrink-0"
                >
                  {followUp.loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  전송
                </Button>
              </form>
            </div>
          )}

          {/* 2. Related Market Ideas */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              관련 시장 아이디어
            </p>
            <div className="flex flex-wrap gap-2">
              {RELATED_MARKET_IDEAS.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => onSelectKeyword(keyword)}
                  disabled={disabled}
                  className={cn(
                    'rounded-lg border border-border/80 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors',
                    'hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
                    'disabled:pointer-events-none disabled:opacity-50'
                  )}
                >
                  {keyword}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Run Another Analysis */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              다른 시장 분석하기
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="새로운 시장 아이디어 입력 (예: AI 계약서 검토)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoComplete="off"
                className="flex-1"
                aria-label="분석할 시장 키워드"
              />
              <Button
                type="submit"
                disabled={disabled || !inputValue.trim()}
                className="gap-1.5 shrink-0"
              >
                <Search className="h-4 w-4" />
                분석 실행
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}
