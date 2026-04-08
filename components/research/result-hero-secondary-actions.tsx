'use client'

import { useEffect, useState } from 'react'
import { FileDown, Bookmark, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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
 * PDF · 인사이트 저장 — 큰 아이콘 버튼 그룹(툴팁으로 보조 설명)
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

  const iconBtnClass =
    'h-11 w-11 shrink-0 rounded-xl border border-border/80 bg-background shadow-sm hover:bg-muted/80 dark:border-border/60 dark:hover:bg-muted/40'

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          'inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-muted/20 p-1.5 shadow-sm dark:bg-muted/15',
          className
        )}
        role="group"
        aria-label="리포트 저장"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void handlePdf()}
              disabled={disabled || pdfPhase === 'loading'}
              className={cn(iconBtnClass, pdfPhase === 'done' && 'border-emerald-500/40 bg-emerald-500/10')}
              aria-label="PDF로 저장"
            >
              {pdfPhase === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              ) : pdfPhase === 'done' ? (
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <FileDown className="h-5 w-5 text-foreground" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">PDF 저장</p>
            <p className="text-xs text-muted-foreground">컨설팅 스타일 리포트를 파일로 받습니다.</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onSaveInsight}
              disabled={disabled || insightSaving}
              className={cn(iconBtnClass, insightPhase === 'saved' && 'border-emerald-500/40 bg-emerald-500/10')}
              aria-label="인사이트 저장"
            >
              {insightSaving ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
              ) : insightPhase === 'saved' ? (
                <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              ) : (
                <Bookmark className="h-5 w-5 text-foreground" aria-hidden />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">인사이트 저장</p>
            <p className="text-xs text-muted-foreground">내 인사이트 보드에 이 분석을 남깁니다.</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  )
}
