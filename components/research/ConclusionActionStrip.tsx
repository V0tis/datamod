'use client'

import { ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { stripLeadingMarkdownHeadings } from '@/lib/strip-markdown-heading-markers'

function cleanActionLine(s: string): string {
  return stripLeadingMarkdownHeadings(s)
    .replace(/^[-*•\d.)\s]+/, '')
    .trim()
}

function takeThreeActionLines(result: ResearchResponse | null): string[] {
  const km = result?.key_metrics
  const actions = km?.pm_actions?.recommended_actions ?? []
  const fromPm = actions
    .map((a) => cleanActionLine(a?.title ?? (a as { action?: string }).action ?? ''))
    .filter(Boolean)
    .slice(0, 3)
  if (fromPm.length >= 3) return fromPm
  const insight = (km?.summary_insights ?? '').trim()
  if (insight) {
    const parts = insight
      .split(/\n+/)
      .map((s) => cleanActionLine(s))
      .filter((s) => s.length > 8)
      .slice(0, 3)
    const merged = [...fromPm]
    for (const p of parts) {
      if (merged.length >= 3) break
      if (!merged.some((m) => m.includes(p.slice(0, 20)))) merged.push(p)
    }
    return merged.slice(0, 3)
  }
  return fromPm.length ? fromPm : ['분석 완료 후 실행 과제가 여기에 표시됩니다.']
}

export function ConclusionActionStrip({
  result,
  className,
}: {
  result: ResearchResponse | null
  className?: string
}) {
  const lines = takeThreeActionLines(result)

  return (
    <div
      className={cn(
        'w-full rounded-xl border border-slate-100 bg-gradient-to-br from-sky-50/80 to-white px-4 py-4 dark:border-zinc-800 dark:from-sky-950/30 dark:to-zinc-900/80 sm:px-5',
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-200">
        <ListTodo className="h-4 w-4 shrink-0" aria-hidden />
        3줄 요약 액션
      </div>
      <ol className="list-decimal space-y-2.5 pl-5 text-sm leading-loose text-slate-700 dark:text-zinc-300">
        {lines.map((line, i) => (
          <li key={i} className="text-pretty [word-break:keep-all]">
            {line}
          </li>
        ))}
      </ol>
    </div>
  )
}
