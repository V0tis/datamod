'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { FileText } from 'lucide-react'
import { InsightDocumentDialog } from '@/components/analysis/insight-document-dialog'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { CompactMarkdown } from '@/components/ui/compact-markdown'
import { cn } from '@/lib/utils'

export interface ExpandableTextProps {
  text: string
  maxLength?: number
  className?: string
  expandLabel?: string
  collapseLabel?: string
  /** `modal`: "더보기" opens a dialog instead of expanding inline (keeps page scroll position). */
  expandMode?: 'inline' | 'modal'
  /** Modal title when expandMode is modal */
  modalTitle?: string
  /** 모달 헤더 아이콘 (기본: FileText) */
  modalIcon?: LucideIcon
  /** true면 본문·모달 모두 마크다운 렌더(모달은 InsightDocumentDialog의 MarkdownBody와 동일 소스) */
  markdown?: boolean
}

export function ExpandableText({
  text,
  maxLength = 150,
  className,
  expandLabel = '더보기',
  collapseLabel = '접기',
  expandMode = 'inline',
  modalTitle = '전체 내용',
  modalIcon = FileText,
  markdown = false,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const safeText = repairMultilingualText(text) || text
  const needsTruncation = safeText.length > maxLength

  if (expandMode === 'modal' && needsTruncation) {
    return (
      <>
        <div className={cn(className, 'inline-block max-w-full')}>
          {markdown ? (
            <div className="inline max-w-full align-top">
              <CompactMarkdown source={safeText} clampClassName="line-clamp-3" className="inline-block max-w-full" />
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="ml-1 align-baseline text-xs font-medium text-primary hover:text-primary/80"
              >
                {expandLabel}
              </button>
            </div>
          ) : (
            <>
              <span className="whitespace-pre-wrap">{safeText.slice(0, maxLength).trim()}…</span>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="ml-1 align-baseline text-xs font-medium text-primary hover:text-primary/80"
              >
                {expandLabel}
              </button>
            </>
          )}
        </div>
        <InsightDocumentDialog
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={modalTitle}
          bodyText={safeText}
          icon={modalIcon}
        />
      </>
    )
  }

  if (markdown) {
    return (
      <div className={className}>
        <CompactMarkdown
          source={safeText}
          clampClassName={!expanded && needsTruncation ? 'line-clamp-3' : undefined}
        />
        {needsTruncation && (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 text-xs font-medium text-primary hover:text-primary/80"
          >
            {expanded ? collapseLabel : expandLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <span className={className}>
      {expanded || !needsTruncation ? safeText : `${safeText.slice(0, maxLength).trim()}...`}
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="ml-1 text-xs font-medium text-primary hover:text-primary/80"
        >
          {expanded ? collapseLabel : expandLabel}
        </button>
      )}
    </span>
  )
}
