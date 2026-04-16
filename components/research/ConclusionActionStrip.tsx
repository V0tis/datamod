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

const PILLAR_LABELS = ['시장 현황', '핵심 기회', '실행 전략'] as const

function takeThreeActionLines(result: ResearchResponse | null): { lines: string[]; labels: readonly string[] } {
  const km = result?.key_metrics
  const fromModel = km?.conclusion_three_lines
  if (Array.isArray(fromModel) && fromModel.length === 3 && fromModel.every((s) => typeof s === 'string' && s.trim())) {
    return { lines: fromModel.map((s) => cleanActionLine(s)), labels: PILLAR_LABELS }
  }
  const actions = km?.pm_actions?.recommended_actions ?? []
  const fromPm = actions
    .map((a) => cleanActionLine(a?.title ?? (a as { action?: string }).action ?? ''))
    .filter(Boolean)
    .slice(0, 3)
  if (fromPm.length >= 1) {
    const pad = '로드맵·스프린트에서 착수 과제로 구체화'
    while (fromPm.length < 3) {
      fromPm.push(pad)
    }
    return { lines: fromPm.slice(0, 3), labels: PILLAR_LABELS }
  }
  return { lines: [], labels: PILLAR_LABELS }
}

export function ConclusionActionStrip({
  result,
  className,
}: {
  result: ResearchResponse | null
  className?: string
}) {
  const { lines, labels } = takeThreeActionLines(result)

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
      <p className="mb-3 text-xs text-slate-500 dark:text-zinc-400">
        현상 → 기회 → 실행 순 비즈니스 결론. 전략 단계에서 산출되거나, 없으면 PM 권장 액션 제목으로 대체합니다.
      </p>
      {lines.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-zinc-400">분석 완료 후 실행 과제가 여기에 표시됩니다.</p>
      ) : (
        <ol className="list-none space-y-3 text-sm leading-snug text-slate-700 dark:text-zinc-300">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-3 text-pretty [word-break:keep-all]">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90">
                {labels[i]}
              </span>
              <span className="min-w-0 flex-1">{line}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
