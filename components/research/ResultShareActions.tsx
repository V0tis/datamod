'use client'

import { useState } from 'react'
import { Share2, FileDown, Copy, Check } from 'lucide-react'
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
  const [shareLoading, setShareLoading] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [copied, setCopied] = useState<'link' | 'summary' | null>(null)

  const handleShareReport = async () => {
    if (disabled) return
    if (reportId) {
      setShareLoading(true)
      try {
        const res = await fetch(`/api/reports/${reportId}/share`, { method: 'POST' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.error((data as { error?: string }).error ?? '공유 링크 생성에 실패했습니다.')
          return
        }
        const url = (data as { url?: string }).url
        if (url) {
          await navigator.clipboard.writeText(url)
          setCopied('link')
          toast.success('공유 링크가 클립보드에 복사되었습니다.')
          setTimeout(() => setCopied(null), 2500)
        }
      } catch {
        toast.error('공유 링크 생성에 실패했습니다.')
      } finally {
        setShareLoading(false)
      }
    } else {
      const url = typeof window !== 'undefined' ? window.location.href : ''
      await navigator.clipboard.writeText(url)
      setCopied('link')
      toast.success('현재 페이지 링크가 복사되었습니다.')
      setTimeout(() => setCopied(null), 2500)
    }
  }

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

  const handleCopySummary = async () => {
    if (disabled || !summaryText.trim()) {
      if (!summaryText.trim()) toast.error('복사할 요약이 없습니다.')
      return
    }
    try {
      await navigator.clipboard.writeText(summaryText.trim())
      setCopied('summary')
      toast.success('핵심 인사이트가 클립보드에 복사되었습니다.')
      setTimeout(() => setCopied(null), 2500)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 sm:border-l sm:border-border/60 sm:pl-4', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleShareReport}
        disabled={disabled || shareLoading}
        className="gap-1.5 text-xs"
      >
        {shareLoading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : copied === 'link' ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
        공유 링크
      </Button>
      <Button
        variant="outline"
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopySummary}
        disabled={disabled || !summaryText.trim()}
        className="gap-1.5 text-xs"
      >
        {copied === 'summary' ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
        요약 복사
      </Button>
    </div>
  )
}
