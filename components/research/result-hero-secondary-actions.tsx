'use client'

import { useEffect, useState } from 'react'
import { FileDown, Bookmark, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { exportAnalysisToPdf } from '@/lib/pdf-export'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { toast } from 'sonner'

export interface ResultHeroSecondaryActionsProps {
  disabled?: boolean
  currentKeyword: string
  displayResult: ResearchResponse | null
  taskData: Partial<Record<string, unknown>>
  countryCode: string
  onSaveInsight: () => void
  /** 저장 성공 시마다 증가 → 헤더 버튼에 잠시 '저장됨' 표시 */
  insightSavedFlashKey?: number
  /** 모달에서 저장 API 진행 중 */
  insightSaving?: boolean
  className?: string
}

/**
 * PDF 저장 + 인사이트 저장 — secondary 그룹, 저장 중/완료 피드백
 */
export function ResultHeroSecondaryActions({
  disabled = false,
  currentKeyword,
  displayResult,
  taskData,
  countryCode,
  onSaveInsight,
  insightSavedFlashKey = 0,
  insightSaving = false,
  className,
}: ResultHeroSecondaryActionsProps) {
  const [pdfPhase, setPdfPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [insightPhase, setInsightPhase] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    if (insightSavedFlashKey <= 0) return
    setInsightPhase('saved')
    const t = window.setTimeout(() => {
      setInsightPhase('idle')
    }, 2800)
    return () => window.clearTimeout(t)
  }, [insightSavedFlashKey])

  useEffect(() => {
    if (pdfPhase !== 'done') return
    const t = window.setTimeout(() => setPdfPhase('idle'), 2200)
    return () => window.clearTimeout(t)
  }, [pdfPhase])

  const handlePdf = async () => {
    if (disabled || pdfPhase === 'loading') return
    setPdfPhase('loading')
    try {
      await exportAnalysisToPdf(
        currentKeyword ?? '',
        displayResult ?? null,
        (taskData ?? {}) as Record<string, unknown>,
        { countryCode }
      )
      toast.success('PDF 리포트가 저장되었습니다.')
      setPdfPhase('done')
    } catch {
      toast.error('PDF 생성에 실패했습니다.')
      setPdfPhase('idle')
    }
  }

  return (
    <div
      className={cn(
        'inline-flex flex-wrap items-center gap-1 rounded-lg border border-border/70 bg-muted/25 p-1 shadow-sm dark:bg-muted/15',
        className
      )}
      role="group"
      aria-label="리포트 저장"
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => void handlePdf()}
        disabled={disabled || pdfPhase === 'loading'}
        className="h-8 gap-1.5 border-0 bg-secondary/90 text-xs shadow-none hover:bg-secondary"
      >
        {pdfPhase === 'loading' ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            저장 중…
          </>
        ) : pdfPhase === 'done' ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            저장됨
          </>
        ) : (
          <>
            <FileDown className="h-3.5 w-3.5" aria-hidden />
            PDF 저장
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onSaveInsight}
        disabled={disabled || insightSaving}
        className="h-8 gap-1.5 border-0 bg-secondary/90 text-xs shadow-none hover:bg-secondary"
      >
        {insightSaving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            저장 중…
          </>
        ) : insightPhase === 'saved' ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
            저장됨
          </>
        ) : (
          <>
            <Bookmark className="h-3.5 w-3.5" aria-hidden />
            인사이트 저장
          </>
        )}
      </Button>
    </div>
  )
}
