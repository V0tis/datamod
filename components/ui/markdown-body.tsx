'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { cn } from '@/lib/utils'

/**
 * 분석 리포트·카드 본문용 마크다운. remark-gfm(표·체크리스트·취소선 등) + @tailwindcss/typography `prose`.
 */
export function MarkdownBody({
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
        'rin-doc prose prose-sm max-w-none dark:prose-invert',
        'prose-headings:font-semibold prose-headings:text-foreground prose-headings:scroll-mt-20',
        'prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground',
        'prose-a:text-primary prose-a:no-underline hover:prose-a:underline',
        'prose-code:text-foreground prose-code:bg-muted/80 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border/60',
        'leading-relaxed',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: c, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {c}
            </a>
          ),
          table: ({ children }) => (
            <div className="rin-table-scroll my-4 overflow-x-auto rounded-lg border border-border/70 bg-card/30 not-prose">
              <table className="w-full min-w-[16rem] border-collapse text-left text-sm">{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
