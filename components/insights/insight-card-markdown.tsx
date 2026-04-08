'use client'

import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { cn } from '@/lib/utils'

type MdProps = { children?: ReactNode; className?: string; node?: unknown }

/**
 * InsightCard 본문 전용: ## → 제목 스타일, 리스트는 disc로 렌더(문법 기호 노출 없음).
 */
export function InsightCardMarkdown({
  children,
  className,
}: {
  children: string | null | undefined
  className?: string
}) {
  const text = repairMultilingualText(children ?? '')
  if (!text.trim()) return null

  return (
    <div
      className={cn(
        'text-sm text-foreground/95 tracking-tight [word-break:keep-all]',
        'leading-relaxed [&_*]:leading-relaxed [&_h2:first-of-type]:mt-0',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children: c, className: cl, ...rest }: MdProps) => (
            <h1 className={cn('text-xl font-bold text-foreground first:mt-0', cl)} {...rest}>
              {c}
            </h1>
          ),
          h2: ({ children: c, className: cl, ...rest }: MdProps) => (
            <h2 className={cn('mt-4 text-lg font-bold text-foreground first:mt-0', cl)} {...rest}>
              {c}
            </h2>
          ),
          h3: ({ children: c, className: cl, ...rest }: MdProps) => (
            <h3 className={cn('mt-3 text-base font-semibold text-foreground', cl)} {...rest}>
              {c}
            </h3>
          ),
          p: ({ node: _n, children: c, className: cl, ...rest }: MdProps) => (
            <div className={cn('mb-3 text-foreground/95 last:mb-0', cl)} {...rest}>
              {c}
            </div>
          ),
          ul: ({ children: c, className: cl, ...rest }: MdProps) => (
            <ul className={cn('my-2 list-disc space-y-1.5 pl-5 marker:text-sky-600/80 dark:marker:text-sky-400/80', cl)} {...rest}>
              {c}
            </ul>
          ),
          ol: ({ children: c, className: cl, ...rest }: MdProps) => (
            <ol className={cn('my-2 list-decimal space-y-1.5 pl-5', cl)} {...rest}>
              {c}
            </ol>
          ),
          li: ({ children: c, className: cl, ...rest }: MdProps) => (
            <li className={cn('text-foreground/95', cl)} {...rest}>
              {c}
            </li>
          ),
          strong: ({ children: c, className: cl, ...rest }: MdProps) => (
            <strong className={cn('font-semibold text-foreground', cl)} {...rest}>
              {c}
            </strong>
          ),
          a: ({ href, children: c, ...props }: { href?: string; children?: ReactNode }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-sky-700 underline-offset-2 hover:underline dark:text-sky-400" {...props}>
              {c}
            </a>
          ),
          blockquote: ({ children: c, className: cl, ...rest }: MdProps) => (
            <blockquote
              className={cn('my-3 border-l-2 border-sky-300/80 pl-3 text-muted-foreground dark:border-sky-600/60', cl)}
              {...rest}
            >
              {c}
            </blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
