'use client'

import ReactMarkdown from 'react-markdown'
import { repairMultilingualText } from '@/lib/text-encoding-repair'
import { cn } from '@/lib/utils'

export function MarkdownBody({
  children,
  className,
}: {
  children: string | null | undefined
  className?: string
}) {
  const text = repairMultilingualText(children ?? '')
  if (!text) return null

  return (
    <div className={cn('rin-doc text-sm leading-relaxed text-foreground', className)}>
      <ReactMarkdown
        components={{
          p: ({ node: _n, ...props }) => <p className="mb-3 last:mb-0 text-foreground" {...props} />,
          strong: ({ node: _n, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
          ul: ({ node: _n, ...props }) => <ul className="my-2 list-disc space-y-1.5 pl-5 text-foreground" {...props} />,
          ol: ({ node: _n, ...props }) => <ol className="my-2 list-decimal space-y-1.5 pl-5 text-foreground" {...props} />,
          li: ({ node: _n, ...props }) => <li className="text-foreground [&>p]:mb-0" {...props} />,
          blockquote: ({ node: _n, ...props }) => (
            <blockquote
              className="my-3 border-l-[3px] border-primary/50 bg-primary/5 py-2 pl-4 pr-2 text-muted-foreground italic rounded-r-md"
              {...props}
            />
          ),
          h1: ({ node: _n, ...props }) => <h3 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0" {...props} />,
          h2: ({ node: _n, ...props }) => <h3 className="mt-4 mb-2 text-base font-semibold text-foreground first:mt-0" {...props} />,
          h3: ({ node: _n, ...props }) => <h4 className="mt-3 mb-1.5 text-sm font-semibold text-foreground" {...props} />,
          code: ({ node: _n, className: codeClass, ...props }) => (
            <code className={cn('rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]', codeClass)} {...props} />
          ),
          table: ({ children }) => (
            <div className="rin-table-scroll my-4 rounded-lg border border-border/70 bg-card/20">
              <table className="w-max min-w-full border-collapse text-left text-sm text-foreground">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border/50">{children}</tr>,
          th: ({ children }) => (
            <th className="border-b border-border bg-muted/50 px-3 py-2 text-left text-xs font-semibold whitespace-nowrap first:rounded-tl-lg last:rounded-tr-lg">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-border/40 px-3 py-2 align-top text-foreground">{children}</td>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
