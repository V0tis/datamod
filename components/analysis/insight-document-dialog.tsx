'use client'

import { useCallback } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Copy, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { MarkdownBody } from '@/components/ui/markdown-body'
import { parseInsightSections } from '@/lib/insight-sections'
import { repairMultilingualText } from '@/lib/text-encoding-repair'

function sectionLabel(kind: 'summary' | 'background' | 'effect'): string {
  if (kind === 'summary') return '핵심 요약'
  if (kind === 'background') return '상세 배경'
  return '예상 효과'
}

function buildCopyPayload(sections: ReturnType<typeof parseInsightSections>, full: string): string {
  const parts: string[] = []
  if (sections.summary) parts.push(`## ${sectionLabel('summary')}\n\n${sections.summary}`)
  if (sections.background) parts.push(`## ${sectionLabel('background')}\n\n${sections.background}`)
  if (sections.effect) parts.push(`## ${sectionLabel('effect')}\n\n${sections.effect}`)
  if (parts.length === 0) return full
  return parts.join('\n\n')
}

export interface InsightDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** 원문(마크다운 가능). 인코딩 보정 후 섹션 분리·렌더 */
  bodyText: string
  icon?: LucideIcon
}

export function InsightDocumentDialog({
  open,
  onOpenChange,
  title,
  bodyText,
  icon: Icon,
}: InsightDocumentDialogProps) {
  const full = repairMultilingualText(bodyText)
  const sections = parseInsightSections(full)

  const handleCopy = useCallback(async () => {
    const payload = buildCopyPayload(sections, full)
    try {
      await navigator.clipboard.writeText(payload)
      toast.success('인사이트를 클립보드에 복사했습니다.')
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }, [full, sections])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 max-h-[min(85vh,720px)]" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 flex-row items-start justify-between gap-3 space-y-0 pr-2">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {Icon ? <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden /> : null}
            <DialogTitle className="text-left text-base sm:text-lg">{title}</DialogTitle>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => onOpenChange(false)} aria-label="닫기">
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4 space-y-6">
          {(sections.summary || (!sections.background && !sections.effect)) && (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {sectionLabel('summary')}
              </h3>
              <MarkdownBody>{sections.summary || full}</MarkdownBody>
            </section>
          )}
          {sections.background ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {sectionLabel('background')}
              </h3>
              <MarkdownBody>{sections.background}</MarkdownBody>
            </section>
          ) : null}
          {sections.effect ? (
            <section>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {sectionLabel('effect')}
              </h3>
              <MarkdownBody>{sections.effect}</MarkdownBody>
            </section>
          ) : null}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-4 w-4" />
            인사이트 복사
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
