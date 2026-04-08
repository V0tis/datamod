'use client'

import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { cn } from '@/lib/utils'

/** 카드·좁은 영역용: h2/h3를 본문 크기에 맞추고 리스트는 compact */
export const COMPACT_MARKDOWN_COMPONENTS: Partial<Components> = {
  p: ({ node: _n, children, className, ...props }) => (
    <div className={cn('mb-1.5 last:mb-0 leading-snug', className)} {...props}>
      {children}
    </div>
  ),
  h1: ({ children }) => <div className="mb-1 text-sm font-semibold leading-snug">{children}</div>,
  h2: ({ children }) => <div className="mb-1 text-sm font-semibold leading-snug">{children}</div>,
  h3: ({ children }) => <div className="mb-1 text-xs font-semibold leading-snug">{children}</div>,
  h4: ({ children }) => <div className="mb-1 text-xs font-semibold leading-snug">{children}</div>,
  ul: ({ children }) => <ul className="my-1 list-inside list-disc space-y-0.5 pl-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-inside list-decimal space-y-0.5 pl-0">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-muted-foreground/30 pl-2 text-muted-foreground">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted/80 px-0.5 font-mono text-[0.85em]">{children}</code>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  table: ({ children }) => (
    <div className="rin-table-scroll my-2 max-w-full rounded-md border border-border/60">
      <table className="w-max min-w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-border/50">{children}</tr>,
  th: ({ children }) => (
    <th className="bg-muted/40 px-2 py-1.5 text-left text-[11px] font-semibold whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => <td className="px-2 py-1.5 align-top">{children}</td>,
}

export function CompactMarkdown({
  source,
  className,
  clampClassName,
}: {
  source: string
  className?: string
  /** e.g. line-clamp-2 — 마크다운 전체에 클램프(미리보기) */
  clampClassName?: string
}) {
  const text = repairMultilingualText(source) || source
  if (!text.trim()) return null
  return (
    <div className={cn('text-sm leading-snug text-foreground [&_blockquote]:text-muted-foreground', clampClassName, className)}>
      <ReactMarkdown components={COMPACT_MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
    </div>
  )
}
