'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarkdownWithSearchLinks } from '@/components/markdown-with-search-links'
import { RinAnimation } from '@/components/common/RinAnimation'
import { Copy, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type AiTabId = 'logic' | 'creative' | 'fact'

export interface GeminiAnalysisProps {
  tabId: AiTabId
  text: string | null
  loading: boolean
  error: string | null
  retryCount: number
  quotaExceeded: boolean
  onRetry: () => void
}

export function GeminiAnalysis({
  tabId,
  text,
  loading,
  error,
  retryCount,
  quotaExceeded,
  onRetry,
}: GeminiAnalysisProps) {
  const isFact = tabId === 'fact'
  return (
    <Card className="flex flex-col border-zinc-200 dark:border-zinc-800 bg-card dark:bg-card dark:hover:bg-[#1c1e21] transition-colors duration-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">Gemini</Badge>
          <div className="flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground dark:text-slate-400" />}
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
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {error ? (
          <div className="rounded-lg border border-border dark:bg-[#0f1113] dark:border-[#00d19a] p-3 flex flex-col gap-2">
            <p className="text-destructive text-sm dark:text-[#00d19a]">
              {error === '무료 쿼터 초과'
                ? '오늘 사용 한도를 모두 사용했어요. 내일 다시 시도하거나, 잠시 후 재시도 버튼을 눌러 주세요.'
                : retryCount >= 3
                  ? '3회 시도 모두 실패했습니다. 버튼을 눌러 수동으로 다시 시도하세요.'
                  : error}
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
            <RinAnimation variant="loading" size={120} className="shrink-0" />
            <p className="text-sm text-muted-foreground dark:text-slate-400">데이터를 불러오는 중입니다</p>
          </div>
        ) : text ? (
          <>
            <div className={cn('prose prose-sm max-w-none text-foreground dark:text-[#e1e3e6] flex-1', isFact && 'prose-lg')}>
              <MarkdownWithSearchLinks text={text} />
            </div>
            <div className="mt-auto pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground dark:text-slate-400"
                onClick={() => text && navigator.clipboard.writeText(text).then(() => toast.success('텍스트가 복사되었어요.'))}
              >
                <Copy className="w-3.5 h-3.5" /> 복사
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground dark:text-slate-400 text-sm">현재 엔진 응답 지연</p>
        )}
      </CardContent>
    </Card>
  )
}
