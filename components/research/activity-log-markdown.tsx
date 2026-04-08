'use client'

import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

/** 분석 활동 로그용: 블록을 전부 div/span으로 두어 p>div hydration 이슈 방지 */
const ACTIVITY_LOG_MD_COMPONENTS: Partial<Components> = {
  p: ({ node: _n, children, className, ...props }) => (
    <div className={cn('leading-snug text-foreground/95', '[&:not(:last-child)]:mb-1', className)} {...props}>
      {children}
    </div>
  ),
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/90">{children}</em>,
  code: ({ children }) => (
    <code className="rounded bg-muted/80 px-1 py-px font-mono text-[0.85em] text-foreground">{children}</code>
  ),
  ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-4">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-4">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline-offset-2 hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <div className="my-1 border-l-2 border-border pl-2 text-muted-foreground">{children}</div>
  ),
  h1: ({ children }) => <div className="mb-1 text-sm font-semibold">{children}</div>,
  h2: ({ children }) => <div className="mb-1 text-sm font-semibold">{children}</div>,
  h3: ({ children }) => <div className="mb-1 text-xs font-semibold">{children}</div>,
  pre: ({ children }) => <div className="my-1 overflow-x-auto rounded bg-muted/50 p-2 font-mono text-[0.85em]">{children}</div>,
}

export function ActivityLogMarkdown({ source, className }: { source: string; className?: string }) {
  if (!source.trim()) return null
  return (
    <div className={cn('text-xs leading-snug [&_strong]:font-semibold', className)}>
      <ReactMarkdown components={ACTIVITY_LOG_MD_COMPONENTS}>{source}</ReactMarkdown>
    </div>
  )
}
