'use client'

import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { printReportAsPdf } from '@/lib/pdf-export'
import { cn } from '@/lib/utils'

export interface ResultShareActionsProps {
  /** Report ID for generating shareable link (POST /api/reports/[id]/share) */
  reportId?: string | null
  /** Summary text to copy (key insights) */
  summaryText?: string
  /** Called when PDF download is triggered. Can return Promise for async export. */
  onDownloadPdf?: () => void | Promise<void>
  disabled?: boolean
  className?: string
}

/**
 * Share and export actions for the AI analysis report:
 * - Share Report: generate shareable link
 * - Download Report: export as PDF
 * - Copy Summary: copy key insights to clipboard
 */
export function ResultShareActions({
  reportId,
  summaryText = '',
  onDownloadPdf,
  disabled = false,
  className,
}: ResultShareActionsProps) {
  const [pdfLoading, setPdfLoading] = useState(false)

  const handleDownloadPdf = async () => {
    if (disabled) return
    const fn = onDownloadPdf ?? printReportAsPdf
    setPdfLoading(true)
    try {
      const result = fn()
      if (result != null && typeof (result as Promise<unknown>).then === 'function') {
        await (result as unknown as Promise<void>)
        toast.success('PDF 리포트가 다운로드되었습니다.')
      } else {
        toast.success('PDF로 저장할 수 있는 인쇄 창이 열립니다.')
      }
    } catch {
      toast.error('PDF 생성에 실패했습니다.')
    } finally {
      setPdfLoading(false)
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 sm:border-l sm:border-border/60 sm:pl-4', className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleDownloadPdf}
        disabled={disabled || pdfLoading}
        className="gap-1.5 text-xs"
      >
        {pdfLoading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <FileDown className="h-3.5 w-3.5" />
        )}
        PDF 저장
      </Button>
    </div>
  )
}
