'use client'

import { useErrorDetailStore } from '@/lib/stores/error-detail-store'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import { useEffect } from 'react'

const isDev = process.env.NODE_ENV === 'development'
const HTML_PREVIEW_MAX = 2000

function looksLikeHtml(str: string): boolean {
  const t = str.trim()
  return t.startsWith('<') || t.includes('<!DOCTYPE') || t.includes('<!doctype')
}

export function ErrorDetailModal() {
  const { detail, errorId, closeDetail } = useErrorDetailStore()

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
            {isDev ? '에러 상세 정보' : '오류 안내'}
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
          {isDev ? (
            <>
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
                  {looksLikeHtml(detail.message) ? '응답 본문 (일부)' : 'Message'}
                </h3>
                <pre className="rounded-lg border border-border bg-muted/50 p-3 text-foreground font-mono text-xs overflow-x-auto whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  <code>
                    {looksLikeHtml(detail.message)
                      ? detail.message.slice(0, HTML_PREVIEW_MAX) + (detail.message.length > HTML_PREVIEW_MAX ? '\n\n… (생략)' : '')
                      : detail.message}
                  </code>
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
            </>
          ) : (
            <>
              <p className="text-foreground">
                시스템 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.
              </p>
              {errorId && (
                <section>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    에러 ID
                  </h3>
                  <pre className="rounded-lg border border-border bg-muted/50 p-3 text-foreground font-mono text-xs">
                    <code>{errorId}</code>
                  </pre>
                  <p className="text-muted-foreground text-xs mt-1">
                    문의 시 위 ID를 알려주시면 도움이 됩니다.
                  </p>
                </section>
              )}
            </>
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
