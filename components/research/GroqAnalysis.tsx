'use client'

import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownWithSearchLinks } from '@/components/markdown-with-search-links'
import { RinAnimation } from '@/components/common/RinAnimation'
import { Copy, RefreshCw, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type AiTabId = 'logic' | 'creative' | 'fact'

export type AnalysisStatus = 'idle' | 'loading' | 'success' | 'error'

export interface GroqAnalysisProps {
  tabId: AiTabId
  text: string | null
  loading: boolean
  error: string | null
  retryCount: number
  onRetry: () => void
}

const CARD_MIN_HEIGHT = 240

function GroqAnalysisComponent({ tabId, text, loading, error, retryCount, onRetry }: GroqAnalysisProps) {
  const [copyFeedback, setCopyFeedback] = useState(false)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFact = tabId === 'fact'
  const status: AnalysisStatus = loading ? 'loading' : error ? 'error' : text ? 'success' : 'idle'

  const statusLabel = status === 'loading' ? '로딩 중' : status === 'success' ? '성공' : status === 'error' ? '실패' : '대기'

  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])

  const handleCopy = useCallback(() => {
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      toast.success('텍스트가 복사되었어요.')
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
      setCopyFeedback(true)
      copyTimeoutRef.current = setTimeout(() => setCopyFeedback(false), 2000)
    })
  }, [text])

  return (
    <Card
      className={cn(
        'flex flex-col border-zinc-200 dark:border-zinc-800 bg-card dark:bg-card dark:hover:bg-[#1c1e21] transition-colors duration-200 min-h-[200px] sm:min-h-[240px] border-l-4 min-w-0',
        status === 'loading' && 'border-l-amber-500',
        status === 'error' && 'border-l-rose-500',
        status === 'success' && 'border-l-emerald-500',
        status === 'idle' && 'border-l-transparent'
      )}
    >
      <CardHeader className="pb-1 sm:pb-2 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Groq (Llama)</Badge>
            <span
              className={cn(
                'text-xs font-medium',
                status === 'success' && 'text-emerald-500 dark:text-emerald-400',
                status === 'error' && 'text-rose-500 dark:text-rose-400',
                status === 'loading' && 'text-amber-500 dark:text-amber-400',
                status === 'idle' && 'text-slate-500 dark:text-slate-400'
              )}
            >
              {statusLabel}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 dark:border-[#00d19a] dark:text-[#00d19a] dark:hover:bg-[#00d19a]/10"
            disabled={loading}
            onClick={onRetry}
          >
            <RefreshCw className="w-3.5 h-3.5" /> 재시도
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 sm:gap-4 min-h-[160px] sm:min-h-[180px] px-4 sm:px-6 pb-4 sm:pb-6">
        {error ? (
          <div className="rounded-lg border border-border dark:bg-[#0f1113] dark:border-[#00d19a] p-3 flex flex-col gap-2">
            <p className="text-destructive text-sm dark:text-[#00d19a]">
              {retryCount >= 3 ? '3회 시도 모두 실패했습니다. 버튼을 눌러 수동으로 다시 시도하세요.' : error}
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
            <RinAnimation variant="loading" size={120} className="shrink-0" />
            <p className="text-sm text-muted-foreground dark:text-slate-400">데이터를 불러오는 중입니다</p>
          </div>
        ) : text ? (
          <>
            <div className={cn('prose prose-sm max-w-none text-foreground dark:text-[#e1e3e6] flex-1 break-words prose-p:break-words prose-li:break-words', isFact && 'sm:prose-lg')}>
              <MarkdownWithSearchLinks text={text} />
            </div>
            <div className="mt-auto pt-2" aria-live="polite">
              <Button
                variant="ghost"
                size="sm"
                className={cn('gap-1.5 text-muted-foreground dark:text-slate-400', copyFeedback && 'text-emerald-600 dark:text-emerald-400')}
                onClick={handleCopy}
              >
                {copyFeedback ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copyFeedback ? '복사됨' : '복사'}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col justify-center min-h-[200px] text-center">
            <p className="text-muted-foreground dark:text-slate-400 text-sm">아직 분석 결과가 없어요. 재시도 버튼을 누르면 이 탭만 다시 분석해요.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export const GroqAnalysis = memo(GroqAnalysisComponent)
