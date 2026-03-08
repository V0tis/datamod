'use client'

import { useState } from 'react'
import { Sparkles, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Related market ideas - AI-focused suggestions */
const RELATED_MARKET_IDEAS = [
  'AI Automation for HR',
  'AI Sales Assistant',
  'AI Legal Tools',
  'AI Marketing Automation',
  'AI Customer Support',
  'AI Document Analysis',
] as const

export interface NextExplorationSectionProps {
  /** Called when user selects a suggested keyword */
  onSelectKeyword: (keyword: string) => void
  /** Called when user runs analysis on a new keyword from input */
  onRunAnalysis: (keyword: string) => void
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
          다른 시장 아이디어를 분석해 보세요.
        </p>

        <div className="space-y-6">
          {/* Related Market Ideas */}
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

          {/* Run Another Analysis */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              다른 시장 분석하기
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                type="text"
                placeholder="새로운 시장 아이디어 입력 (예: AI Contract Review)"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                disabled={disabled}
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
