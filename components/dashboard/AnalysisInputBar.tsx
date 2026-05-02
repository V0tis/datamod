'use client'

import type { RefObject } from 'react'
import { Search, X, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DepthMode } from '@/lib/analysis-estimates'
import { cn } from '@/lib/utils'

const QUICK_KEYWORDS = [
  'AI 작성 도구',
  '리모트워크 SaaS',
  '푸드테크',
  '에듀테크',
  'B2B 결제',
  '클린뷰티 D2C',
]

const DEPTH_META: { mode: DepthMode; label: string; desc: string }[] = [
  { mode: 'fast', label: '빠른', desc: '~1분 · 15K 토큰' },
  { mode: 'standard', label: '표준', desc: '2~5분 · 45K 토큰' },
  { mode: 'deep', label: '심층', desc: '5~7분 · 120K 토큰' },
]

export function AnalysisInputBar({
  id,
  inputRef,
  keyword,
  onKeywordChange,
  depth,
  onDepthChange,
  onStart,
  onAbort,
  busy,
  showAbort,
}: {
  id?: string
  inputRef?: RefObject<HTMLInputElement | null>
  keyword: string
  onKeywordChange: (value: string) => void
  depth: DepthMode
  onDepthChange: (d: DepthMode) => void
  onStart: () => void
  onAbort: () => void
  busy: boolean
  showAbort: boolean
}) {
  const depthDesc = DEPTH_META.find((d) => d.mode === depth)?.desc ?? ''

  return (
    <div id={id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* Row 1: 입력 + 깊이 + CTA */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
          <Search className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onStart()
              }
            }}
            placeholder="분석할 시장 키워드를 입력하세요  (예: AI 채용 도구, 헬스케어 플랫폼)"
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400 disabled:opacity-60"
            autoFocus
            aria-label="분석할 시장 키워드"
          />
          {keyword && !busy && (
            <button
              type="button"
              onClick={() => onKeywordChange('')}
              className="text-gray-300 transition-colors hover:text-gray-500"
              aria-label="입력 지우기"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:gap-1">
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {DEPTH_META.map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => onDepthChange(mode)}
                disabled={busy}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40',
                  depth === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {showAbort ? (
            <Button type="button" variant="danger" onClick={onAbort} size="sm" className="shrink-0 rounded-xl px-5 py-3">
              <X className="mr-1 h-3.5 w-3.5" />
              중단
            </Button>
          ) : (
            <button
              type="button"
              onClick={onStart}
              disabled={!keyword.trim() || busy}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Play className="h-4 w-4" />
              분석 시작
            </button>
          )}
        </div>
      </div>

      {/* Row 2: 예상 시간 + 바로 분석 키워드 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <span className="shrink-0 text-xs text-gray-400">{depthDesc}</span>
        <div className="hidden h-3 w-px shrink-0 bg-gray-200 sm:block" />
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="shrink-0 text-xs text-gray-400">바로 분석:</span>
          {QUICK_KEYWORDS.map((kw) => (
            <button
              key={kw}
              type="button"
              onClick={() => onKeywordChange(kw)}
              disabled={busy}
              className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-600 disabled:opacity-40"
            >
              {kw}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
