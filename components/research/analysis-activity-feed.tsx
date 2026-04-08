'use client'

import { useEffect, useRef } from 'react'
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Cpu,
  Info,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useResearchStore } from '@/lib/stores/research-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ActivityLogMarkdown } from '@/components/research/activity-log-markdown'

function formatPrimaryAiLabel(model: 'gemini' | 'groq' | undefined): string {
  if (model === 'groq') return 'Groq · Llama 3'
  if (model === 'gemini') return 'Gemini'
  return '기본'
}

function isErrorRow(row: { kind?: 'error'; type?: 'error' }): boolean {
  return row.kind === 'error' || row.type === 'error'
}

/** 긴 원문·다줄 로그는 접어서 밀도 확보 */
function shouldCollapseLog(message: string): boolean {
  const t = message.trim()
  if (t.length > 180) return true
  const lines = t.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length >= 3) return true
  if (/(수집된\s*기사|기사\s*원문|원문\s*미리보기|article\s*body)/i.test(t) && t.length > 80) return true
  return false
}

function plainSummaryPreview(message: string): string {
  const first = message.split(/\r?\n/).find((l) => l.trim()) ?? message
  const stripped = first.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1')
  const t = stripped.trim()
  return t.length > 120 ? `${t.slice(0, 117)}…` : t
}

export function AnalysisActivityFeed({
  className,
  onRetry,
  primaryAiModel,
}: {
  className?: string
  onRetry?: () => void
  /** 결과 페이지 등에서 전달 — 스티키 배지에 표시 */
  primaryAiModel?: 'gemini' | 'groq'
}) {
  const log = useResearchStore((s) => s.streamingActivityLog)
  const analyzing = useResearchStore((s) => s.analysisStatus === 'analyzing')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log])

  if (log.length === 0 && !analyzing) return null

  const aiBadge = formatPrimaryAiLabel(primaryAiModel)

  return (
    <div
      className={cn(
        'rounded-xl border border-border/80 bg-card/50 shadow-sm overflow-hidden flex flex-col',
        'max-h-[min(22rem,52vh)] min-h-[8.5rem]',
        className
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-muted/35 px-3 py-2.5 sm:px-4">
        {analyzing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" aria-hidden />
        ) : (
          <Activity className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            분석 활동
          </div>
          <div className="text-[10px] text-muted-foreground/90 mt-0.5 hidden sm:block">
            단계별 진행·알림을 카드 형태로 표시합니다.
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth overscroll-contain">
        <div
          className={cn(
            'sticky top-0 z-10 border-b border-border/50',
            'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80'
          )}
        >
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4 border-b border-border/30">
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
            ) : (
              <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="text-[11px] font-semibold text-foreground">
              {analyzing ? '현재 분석 중…' : '분석 대기 · 최근 로그'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:px-4">
            <Cpu className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              현재 사용 중인 AI
            </span>
            <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0">
              {aiBadge}
            </Badge>
          </div>
        </div>

        <ul className="space-y-2 p-3 sm:p-4" aria-live="polite" aria-relevant="additions">
          {log.length === 0 && analyzing ? (
            <li className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              파이프라인에 연결되는 중…
            </li>
          ) : (
            log.map((row, i) => {
              const err = isErrorRow(row)
              const collapse = shouldCollapseLog(row.message)
              return (
                <li key={`${row.ts}-${i}`}>
                  <div
                    className={cn(
                      'rounded-lg border px-3 py-2.5 shadow-sm transition-colors',
                      err
                        ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/35'
                        : 'border-border/70 bg-background/90 dark:bg-card/60'
                    )}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
                      <div className="flex shrink-0 items-start gap-2.5">
                        <div className="shrink-0 pt-0.5" aria-hidden>
                          {err ? (
                            <AlertCircle className={cn('h-4 w-4', 'text-red-600 dark:text-red-400')} />
                          ) : (
                            <Info className="h-4 w-4 text-primary/80" />
                          )}
                        </div>
                        <time
                          className="shrink-0 tabular-nums text-[10px] font-medium text-muted-foreground pt-0.5 w-[4.75rem] sm:w-[5.25rem]"
                          dateTime={new Date(row.ts).toISOString()}
                        >
                          {new Date(row.ts).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </time>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5 sm:min-w-[8rem]">
                        {collapse ? (
                          <details
                            className={cn(
                              'group rounded-md border bg-muted/15 open:bg-muted/25',
                              err
                                ? 'border-red-200/80 bg-red-100/25 dark:border-red-900/50 dark:bg-red-950/25'
                                : 'border-border/40'
                            )}
                          >
                            <summary
                              className={cn(
                                'flex cursor-pointer list-none items-start gap-1.5 px-2 py-1.5 text-left',
                                '[&::-webkit-details-marker]:hidden',
                                'text-[11px] text-muted-foreground hover:text-foreground',
                                'marker:content-none'
                              )}
                            >
                              <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                              <span className="line-clamp-2 leading-snug">{plainSummaryPreview(row.message)}</span>
                            </summary>
                            <div className="border-t border-border/35 px-2 pb-2 pt-2">
                              <ActivityLogMarkdown source={row.message} />
                            </div>
                          </details>
                        ) : (
                          <ActivityLogMarkdown source={row.message} />
                        )}
                      </div>
                      {err && onRetry ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className={cn(
                            'h-8 shrink-0 gap-1.5 self-end border-red-300 text-red-700 sm:self-start',
                            'hover:bg-red-100 hover:text-red-800',
                            'dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/80'
                          )}
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onRetry()
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                          재시도
                        </Button>
                      ) : err ? (
                        <span
                          className="shrink-0 self-end pt-0.5 text-red-600 dark:text-red-400 sm:self-start"
                          title="오류"
                          aria-hidden
                        >
                          <RefreshCw className="h-4 w-4" />
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })
          )}
          <div ref={bottomRef} className="h-px w-full shrink-0 scroll-mt-0" aria-hidden />
        </ul>
      </div>
    </div>
  )
}
