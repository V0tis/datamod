'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { normalizeAiMarkdownForDisplay } from '@/lib/markdown-ai-display'
import { cn } from '@/lib/utils'

const headingClass =
  'font-bold text-foreground leading-snug scroll-mt-20 first:mt-0 [&+p]:mt-2 [&+div]:mt-2'

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
  const text = normalizeAiMarkdownForDisplay(repairMultilingualText(children ?? ''))
  if (!text.trim()) return null

  return (
    <div
      className={cn(
        'rin-doc prose prose-sm max-w-none dark:prose-invert',
        'prose-headings:!font-bold prose-headings:!text-foreground prose-headings:!mb-0',
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
          h1: ({ children: c }) => (
            <h1 className={cn(headingClass, 'mt-8 text-xl first:mt-0')}>{c}</h1>
          ),
          h2: ({ children: c }) => (
            <h2 className={cn(headingClass, 'mt-7 text-lg')}>{c}</h2>
          ),
          h3: ({ children: c }) => (
            <h3 className={cn(headingClass, 'mt-6 text-lg')}>{c}</h3>
          ),
          h4: ({ children: c }) => (
            <h4 className={cn(headingClass, 'mt-5 text-base')}>{c}</h4>
          ),
          h5: ({ children: c }) => (
            <h5 className={cn(headingClass, 'mt-4 text-sm')}>{c}</h5>
          ),
          h6: ({ children: c }) => (
            <h6 className={cn(headingClass, 'mt-4 text-sm text-muted-foreground')}>{c}</h6>
          ),
          /** 블록 마크다운이 중첩될 때 <p><div/> 같은 잘못된 HTML·hydration mismatch 방지 */
          p: ({ node: _n, children, className, ...props }) => (
            <div className={cn('mb-4 last:mb-0 leading-relaxed', className)} {...props}>
              {children}
            </div>
          ),
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
