'use client'

import Link from 'next/link'
import { ChevronRight, Download, RefreshCw, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { useResearchStore } from '@/lib/stores/research-store'
import { exportAnalysisToPdf } from '@/lib/pdf-export'
import { toast } from 'sonner'
import { dmColors } from '@/lib/designTokens'

export type AnalysisHeaderRunState = 'running' | 'completed' | 'error' | 'idle'

function countryFlagEmoji(code: string): string {
  const c = code.trim().toUpperCase()
  const m: Record<string, string> = {
    KR: '🇰🇷',
    US: '🇺🇸',
    JP: '🇯🇵',
    TW: '🇹🇼',
    HK: '🇭🇰',
    GB: '🇬🇧',
    DE: '🇩🇪',
  }
  return m[c] ?? '🌐'
}

function countryDisplayName(code: string): string {
  const c = code.trim().toUpperCase()
  const m: Record<string, string> = {
    KR: '한국',
    US: '미국',
    JP: '일본',
    TW: '대만',
    HK: '홍콩',
    GB: '영국',
    DE: '독일',
  }
  return m[c] ?? c
}

function StatusPill({ status }: { status: AnalysisHeaderRunState }) {
  const styles: Record<AnalysisHeaderRunState, string> = {
    running: 'bg-[var(--dm-color-primary-light)] text-[var(--dm-color-primary)] border-[var(--dm-color-border)]',
    completed: 'bg-[var(--dm-color-success-light)] text-[var(--dm-color-success)] border-[var(--dm-color-border)]',
    error: 'bg-[var(--dm-color-danger-light)] text-[var(--dm-color-danger)] border-[var(--dm-color-border)]',
    idle: 'bg-[var(--dm-color-bg)] text-[var(--dm-color-text-muted)] border-[var(--dm-color-border)]',
  }
  const label: Record<AnalysisHeaderRunState, string> = {
    running: '분석 중',
    completed: '완료',
    error: '오류',
    idle: '대기',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        styles[status]
      )}
    >
      {label[status]}
    </span>
  )
}

export interface AnalysisResultHeaderBarProps {
  keyword: string
  countryCode: string
  runState: AnalysisHeaderRunState
  aiPrimaryModel?: 'gemini' | 'groq'
  displayResult: ResearchResponse | null
  taskData: Partial<Record<string, unknown>>
  disabled?: boolean
  className?: string
}

/**
 * Sticky analysis header: breadcrumb · 상태 · 모델 배지 · 재분석/공유/PDF
 */
export function AnalysisResultHeaderBar({
  keyword,
  countryCode,
  runState,
  aiPrimaryModel = 'gemini',
  displayResult,
  taskData,
  disabled = false,
  className,
}: AnalysisResultHeaderBarProps) {
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)

  const handleReanalyze = () => {
    const k = keyword.trim()
    if (!k || disabled) return
    void startStreamingResearch(k, {
      country_code: countryCode,
      ai_primary_model: aiPrimaryModel,
      force_reanalyze: true,
    }).catch(() => {})
  }

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('링크가 클립보드에 복사되었습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  const handlePdf = async () => {
    if (disabled) return
    try {
      await exportAnalysisToPdf(keyword ?? '', displayResult ?? null, (taskData ?? {}) as Record<string, unknown>, {
        countryCode,
      })
      toast.success('PDF 리포트가 저장되었습니다.')
    } catch {
      toast.error('PDF 생성에 실패했습니다.')
    }
  }

  const kw = keyword.trim() || '—'

  return (
    <div
      className={cn(
        'border-b border-[var(--dm-color-border)] bg-[var(--dm-color-surface)] px-4 py-3 sm:px-6',
        className
      )}
    >
      <div className="flex min-h-[52px] flex-wrap items-center gap-x-3 gap-y-2">
        <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-[var(--dm-color-text-muted)]">
          <Link href="/history" className="shrink-0 hover:text-[var(--dm-color-text-secondary)]">
            분석 기록
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          <span className="truncate font-medium text-[var(--dm-color-text-primary)]">&quot;{kw}&quot;</span>
          <span className="shrink-0 text-[var(--dm-color-border-strong)]">·</span>
          <span className="shrink-0 whitespace-nowrap">
            <span className="mr-1">{countryFlagEmoji(countryCode)}</span>
            {countryDisplayName(countryCode)}
          </span>
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={runState} />

          <div className="flex items-center gap-1 text-xs">
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 font-medium',
                aiPrimaryModel === 'gemini'
                  ? 'border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
              )}
            >
              Gemini
            </span>
            <span className="text-[var(--dm-color-border-strong)]">+</span>
            <span
              className={cn(
                'rounded-md border px-2 py-0.5 font-medium',
                aiPrimaryModel === 'groq'
                  ? 'border-purple-100 bg-purple-50 text-purple-600 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
              )}
            >
              Groq
            </span>
          </div>
        </div>

        <div className="flex flex-1 basis-full items-center justify-end gap-2 sm:basis-auto sm:pl-2">
          <button
            type="button"
            onClick={handleReanalyze}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--dm-color-text-secondary)] transition-colors hover:bg-[var(--dm-color-bg)] hover:text-[var(--dm-color-text-primary)] disabled:opacity-50"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            재분석
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-[var(--dm-color-text-secondary)] transition-colors hover:bg-[var(--dm-color-bg)] hover:text-[var(--dm-color-text-primary)]"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            공유
          </button>
          <button
            type="button"
            onClick={() => void handlePdf()}
            disabled={disabled || !displayResult?.reportId}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:opacity-50"
            style={{ backgroundColor: dmColors.primary }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            PDF 저장
          </button>
        </div>
      </div>
    </div>
  )
}
