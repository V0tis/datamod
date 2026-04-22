'use client'

import { useMemo } from 'react'
import { AlignLeft, ChevronRight, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { dmColors, dmScoreColors } from '@/lib/designTokens'
import { breakdownDimensionTo10 } from '@/lib/score-display'
import { resolveCompetitionScore10 } from '@/components/analysis/analysis-summary-header'
import { extractNextActionItems } from '@/components/research/NextActionsForPM'
import { normalizeActionTimeline, urgencyToPriorityLevel } from '@/lib/research-priority-outcomes'
import { takeThreeActionLines, type ConclusionActionStripTaskRow } from '@/components/research/ConclusionActionStrip'
import { scrollToReportSection } from '@/components/analysis/report-scroll-toc'
import { ConclusionStructuredBlocks } from '@/components/research/ConclusionStructuredBlocks'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'

const DONUT_R = 50
const DONUT_C = 2 * Math.PI * DONUT_R

function getKpiBarColor(value: number | null, max: number, invert?: boolean): string {
  if (value == null || !Number.isFinite(value)) return dmColors.textMuted
  const ratio = Math.min(1, Math.max(0, value / max))
  if (invert) {
    if (ratio >= 0.7) return dmScoreColors.risk
    if (ratio >= 0.4) return dmColors.warning
    return dmScoreColors.high
  }
  if (ratio >= 0.7) return dmScoreColors.high
  if (ratio >= 0.5) return dmScoreColors.mid
  return dmScoreColors.low
}

function getDonutStroke(score: number): string {
  if (score >= 70) return dmScoreColors.high
  if (score >= 50) return dmScoreColors.mid
  return dmScoreColors.low
}

function getSummaryCounts(km: ResearchResponse['key_metrics'] | undefined) {
  if (!km) return { positiveCount: 0, competitorCount: 0, riskCount: 0 }
  const positiveCount = Array.isArray(km.positive_signals) ? km.positive_signals.length : 0
  const competitorCount = Array.isArray(km.competitive_landscape) ? km.competitive_landscape.length : 0
  const riskCount =
    (Array.isArray(km.negative_risks) ? km.negative_risks.length : 0) +
    (Array.isArray(km.risk_signals) ? km.risk_signals.length : 0)
  return { positiveCount, competitorCount, riskCount }
}

export function SummaryExecutiveThreeZones({
  result,
  taskData,
  analysisTasks,
  opportunityScore,
  scoreLoading,
  analysisFailed,
  conclusionBackgroundMarkdown,
  highlightTerms,
}: {
  result: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: ConclusionActionStripTaskRow[] | null
  opportunityScore: number | null
  scoreLoading: boolean
  analysisFailed: boolean
  conclusionBackgroundMarkdown: string
  highlightTerms: string[]
}) {
  const km = result?.key_metrics
  const { positiveCount, competitorCount, riskCount } = useMemo(() => getSummaryCounts(km), [km])

  const { growthScore, competitionScore, opportunityDim10 } = useMemo(() => {
    const b = km?.opportunity_score_breakdown ?? {}
    const growth10 = breakdownDimensionTo10(typeof b.market_growth === 'number' ? b.market_growth : undefined)
    const trend10 = breakdownDimensionTo10(typeof b.trend_momentum === 'number' ? b.trend_momentum : undefined)
    const marketDim = growth10 ?? trend10
    const competition10 = resolveCompetitionScore10(
      km?.opportunity_score_breakdown,
      km?.strategic_decision_layer?.competition_intensity
    )
    const opp10 =
      typeof km?.opportunity_score === 'number' && Number.isFinite(km.opportunity_score)
        ? breakdownDimensionTo10(km.opportunity_score)
        : null
    return {
      growthScore: marketDim,
      competitionScore: competition10,
      opportunityDim10: opp10,
    }
  }, [km])

  const topActions = useMemo(() => {
    return extractNextActionItems(
      result,
      taskData,
      analysisTasks as Parameters<typeof extractNextActionItems>[2],
      { maxItems: 12 }
    )
      .filter((a) => a.action?.trim())
      .map((a, idx) => {
        const why = sanitizeForKoreanDisplay(a.why)?.trim()
        const how = sanitizeForKoreanDisplay(a.how_to_execute)?.trim()
        const impact = why && why.length >= 4 ? why : how && how.length >= 4 ? how : '기대효과·실행 방향 확인'
        const tl = normalizeActionTimeline(a.estimated_effort)
        return {
          id: `exec-pm-${idx}`,
          priority: urgencyToPriorityLevel(a.priority) as 0 | 1 | 2,
          title: a.action!.trim(),
          impact: impact.length > 96 ? `${impact.slice(0, 93)}…` : impact,
          timeline: tl === '미정' ? '기간 미정' : tl,
        }
      })
      .sort((x, y) => x.priority - y.priority)
      .slice(0, 5)
  }, [result, taskData, analysisTasks])

  const { lines: threeLines } = takeThreeActionLines(result, taskData, analysisTasks)
  const summary = {
    current: threeLines[0] ?? '',
    opportunity: threeLines[1] ?? '',
    action: threeLines[2] ?? '',
  }

  const displayScore =
    opportunityScore != null && Number.isFinite(opportunityScore)
      ? Math.round(Math.min(100, Math.max(0, opportunityScore)))
      : null

  const dashOffset = displayScore != null ? (displayScore / 100) * DONUT_C : 0

  const scrollToAction = () => scrollToReportSection('action-section')

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-stretch">
        {/* Zone 1 */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-white px-4 py-8 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="relative mb-4 h-32 w-32">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r={DONUT_R} fill="none" stroke={dmColors.border} strokeWidth="10" className="dark:stroke-zinc-700" />
              {displayScore != null && !scoreLoading ? (
                <circle
                  cx="60"
                  cy="60"
                  r={DONUT_R}
                  fill="none"
                  stroke={getDonutStroke(displayScore)}
                  strokeWidth="10"
                  strokeDasharray={`${dashOffset} ${DONUT_C}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease' }}
                />
              ) : null}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {scoreLoading && displayScore == null && !analysisFailed ? (
                <span className="text-lg font-semibold text-slate-400 dark:text-zinc-500">…</span>
              ) : displayScore != null ? (
                <>
                  <span className="text-3xl font-extrabold tabular-nums text-slate-900 dark:text-zinc-50">{displayScore}</span>
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">/ 100</span>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold tabular-nums text-slate-400 dark:text-zinc-500">—</span>
                  <span className="text-xs font-medium text-slate-400 dark:text-zinc-500">/ 100</span>
                </>
              )}
            </div>
          </div>
          <div className="mb-1 text-sm font-semibold text-slate-700 dark:text-zinc-200">시장 기회 점수</div>
          <div className="mb-6 text-center text-xs text-slate-400 dark:text-zinc-500">
            긍정 신호 {positiveCount}건 · 경쟁사 {competitorCount}개 · 리스크 {riskCount}건
          </div>
          <div className="w-full max-w-sm space-y-3">
            {(
              [
                { label: '시장 성장성', value: growthScore, max: 10, invert: false as const },
                { label: '경쟁 강도', value: competitionScore, max: 10, invert: true as const },
                { label: '시장 기회', value: opportunityDim10, max: 10, invert: false as const },
              ] as const
            ).map((kpi) => (
              <div key={kpi.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium text-slate-500 dark:text-zinc-400">{kpi.label}</span>
                  <span
                    className="font-bold tabular-nums"
                    style={{ color: getKpiBarColor(kpi.value, kpi.max, kpi.invert) }}
                  >
                    {kpi.value !== null ? `${kpi.value}/10` : '--'}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: kpi.value !== null ? `${(kpi.value / kpi.max) * 100}%` : '0%',
                      background: getKpiBarColor(kpi.value, kpi.max, kpi.invert),
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Zone 2 */}
        <div className="flex flex-col rounded-xl border border-slate-100 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 dark:bg-blue-500">
                <Zap className="h-3.5 w-3.5 text-white" aria-hidden />
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-zinc-50">우선 PM 액션</span>
            </div>
            <span className="text-xs text-slate-400 dark:text-zinc-500">지금 당장 실행 가능한 순서</span>
          </div>
          <div className="min-h-[8rem] flex-1 space-y-2">
            {topActions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
                실행 단계 산출 또는 PM 액션 플랜이 없습니다. 분석 완료 후 다시 확인해 주세요.
              </p>
            ) : (
              topActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={scrollToAction}
                  className="group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-zinc-900/80"
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                      action.priority === 0 && 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-200',
                      action.priority === 1 && 'bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-200',
                      action.priority === 2 && 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200'
                    )}
                  >
                    P{action.priority}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-zinc-100">{action.title}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-zinc-500">
                      {action.impact} · {action.timeline}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-300 transition-colors group-hover:text-blue-500 dark:text-zinc-600 dark:group-hover:text-blue-400" aria-hidden />
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={scrollToAction}
            className="mt-4 w-full rounded-lg border border-blue-100 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-950/40"
          >
            전체 PM 액션 플랜 보기 →
          </button>
        </div>
      </div>

      {/* Zone 3 */}
      <div className="rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-5 dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-950 sm:px-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-zinc-700">
            <AlignLeft className="h-4 w-4 text-slate-500 dark:text-zinc-300" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
              AI 3줄 요약
            </div>
            {summary.current || summary.opportunity || summary.action ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <span className="w-8 flex-shrink-0 text-xs font-bold text-orange-500">현상</span>
                  <p className="text-pretty text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{summary.current || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-8 flex-shrink-0 text-xs font-bold text-blue-600 dark:text-blue-400">기회</span>
                  <p className="text-pretty text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{summary.opportunity || '—'}</p>
                </div>
                <div className="flex gap-2">
                  <span className="w-8 flex-shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400">실행</span>
                  <p className="text-pretty text-sm leading-relaxed text-slate-700 dark:text-zinc-300">{summary.action || '—'}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
                전략·실행 단계 산출 또는 요약 필드가 없어 3줄을 구성할 수 없습니다. 재분석 후에도 비면 모델 응답 형식을 확인해 주세요.
              </p>
            )}
          </div>
        </div>
        <details className="mt-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
          <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
            배경 및 근거 자세히 보기
          </summary>
          <div className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-zinc-400">
            <ConclusionStructuredBlocks markdown={conclusionBackgroundMarkdown} highlightTerms={highlightTerms} />
          </div>
        </details>
      </div>
    </div>
  )
}
