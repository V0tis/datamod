'use client'

import { BookOpen, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'

export function AnalysisSourceButton({
  result,
  className,
  label = '출처',
}: {
  result: ResearchResponse | null
  className?: string
  label?: string
}) {
  const first = result?.source_links?.find((s) => typeof s.url === 'string' && s.url.trim().length > 0)
  const url = first?.url?.trim()

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200',
          className
        )}
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label}
      </a>
    )
  }

  return (
    <a
      href="#section-detail"
      className={cn(
        'inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:border-sky-300 hover:text-sky-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200',
        className
      )}
    >
      <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label}
    </a>
  )
}
