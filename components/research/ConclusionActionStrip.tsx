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

const PILLAR_LABELS = ['현상', '기회', '실행'] as const

function takePmActionTitles(result: ResearchResponse | null): string[] {
  const actions = result?.key_metrics?.pm_actions?.recommended_actions ?? []
  return actions
    .map((a) => cleanActionLine(a?.title ?? (a as { action?: string }).action ?? ''))
    .filter(Boolean)
}

function takeKeyStrategicLines(result: ResearchResponse | null): string[] {
  const raw = result?.key_metrics?.key_strategic_insights
  if (!Array.isArray(raw)) return []
  return raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => cleanActionLine(s))
    .filter(Boolean)
    .slice(0, 3)
}

function takeMarketSummaryLine(result: ResearchResponse | null): string | null {
  const s = result?.key_metrics?.market_summary
  if (typeof s !== 'string') return null
  const t = cleanActionLine(s)
  return t.length > 8 ? t : null
}

/** conclusion_three_lines(1~3) + PM 액션·인사이트로 3줄 구성. 더미 패딩 문자열 사용 안 함 */
function takeThreeActionLines(result: ResearchResponse | null): { lines: string[]; labels: readonly string[] } {
  const km = result?.key_metrics
  const rawThree = km?.conclusion_three_lines
  const fromModel = Array.isArray(rawThree)
    ? rawThree.map((s) => cleanActionLine(typeof s === 'string' ? s : '')).filter(Boolean).slice(0, 3)
    : []

  if (fromModel.length === 3) {
    return { lines: fromModel, labels: PILLAR_LABELS }
  }

  const merged: string[] = [...fromModel]
  const pmTitles = takePmActionTitles(result)
  const insights = takeKeyStrategicLines(result)
  const marketLine = takeMarketSummaryLine(result)

  for (const t of pmTitles) {
    if (merged.length >= 3) break
    if (t && !merged.includes(t)) merged.push(t)
  }
  for (const t of insights) {
    if (merged.length >= 3) break
    if (t && !merged.includes(t)) merged.push(t)
  }
  if (merged.length < 3 && marketLine && !merged.includes(marketLine)) {
    merged.push(marketLine)
  }

  return { lines: merged.slice(0, 3), labels: PILLAR_LABELS }
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
      <p className="mb-3 text-xs leading-relaxed tracking-wide text-slate-500 dark:text-zinc-400">
        현상(경쟁·문제) → 기회(니치) → 실행(최우선 과제) 순. 전략 단계 산출값이 있으면 즉시 반영됩니다.
      </p>
      {lines.length === 0 ? (
        <p className="text-sm leading-relaxed tracking-wide text-slate-600 dark:text-zinc-400">
          전략 단계가 완료되면 여기에 3줄 요약이 표시됩니다.
        </p>
      ) : (
        <ol className="m-0 list-none space-y-3 p-0 text-sm leading-[1.65] tracking-wide text-pretty text-slate-700 dark:text-zinc-300 [word-break:keep-all]">
          {lines.map((line, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90">
                {labels[i] ?? PILLAR_LABELS[Math.min(i, 2)]}
              </span>
              <span className="min-w-0 flex-1">{line}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
