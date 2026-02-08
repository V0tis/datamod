'use client'

import { useErrorDetailStore } from '@/lib/stores/error-detail-store'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useEffect } from 'react'

export function ErrorDetailModal() {
  const { detail, closeDetail } = useErrorDetailStore()

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetail()
    }
    if (detail) {
      document.addEventListener('keydown', onEscape)
      return () => document.removeEventListener('keydown', onEscape)
    }
  }, [detail, closeDetail])

  if (!detail) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="error-detail-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeDetail}
        aria-hidden
      />
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-white shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/30 shrink-0">
          <h2 id="error-detail-title" className="font-semibold text-foreground">
            에러 상세 정보
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={closeDetail}
            className="shrink-0"
            aria-label="닫기"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4 text-sm">
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Code
            </h3>
            <pre className="rounded-lg border border-border bg-muted/50 p-3 text-foreground font-mono text-xs overflow-x-auto">
              <code>{detail.code}</code>
            </pre>
          </section>
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Message
            </h3>
            <pre className="rounded-lg border border-border bg-muted/50 p-3 text-foreground font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
              <code>{detail.message}</code>
            </pre>
          </section>
          {detail.hint !== '—' && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Hint
              </h3>
              <pre className="rounded-lg border border-border bg-muted/50 p-3 text-foreground font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
                <code>{detail.hint}</code>
              </pre>
            </section>
          )}
          {detail.details !== '—' && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Details
              </h3>
              <pre className="rounded-lg border border-border bg-muted/50 p-3 text-foreground font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words">
                <code>{detail.details}</code>
              </pre>
            </section>
          )}
        </div>
        <div className="border-t border-border px-4 py-3 shrink-0">
          <Button type="button" variant="outline" onClick={closeDetail} className="w-full">
            닫기
          </Button>
        </div>
      </div>
    </div>
  )
}
