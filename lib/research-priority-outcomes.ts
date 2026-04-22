import type { ResearchResponse } from '@/lib/stores/research-store'
import { sanitizeForKoreanDisplay } from '@/lib/text-sanitize'

export type PriorityInsightItem = {
  /** P0 = 최우선(high), P1 = 중간, P2 = 낮음 */
  priority: 0 | 1 | 2
  title: string
  description: string
  timeline: string
  impact: string
}

/** UI 표시용: "예상 기간:" 중복·미기재 문구 정리 */
export function normalizeActionTimeline(raw?: string | null): string {
  if (!raw?.trim()) return '미정'
  let s = raw.trim().replace(/^예상\s*기간\s*[:：]\s*/i, '').trim()
  if (!s || s === '미기재') return '미정'
  return s
}

export type OutcomeMetricItem = {
  value: string
  label: string
  basis: string
}

function getTaskOutputRecord(
  step: string,
  taskData: Partial<Record<string, unknown>>,
  analysisTasks: Array<{ step_name: string; output_data?: unknown }> | null | undefined
): Record<string, unknown> | null {
  const task = analysisTasks?.find((t) => t.step_name === step)
  const raw =
    task?.output_data && typeof task.output_data === 'object' ? task.output_data : taskData[step]
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

type PlanRow = { action_title?: string; description?: string; expected_outcome?: string; priority?: string }

export function urgencyToPriorityLevel(p?: string): 0 | 1 | 2 {
  const x = (p ?? 'medium').toLowerCase()
  if (x === 'high') return 0
  if (x === 'low') return 2
  return 1
}

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

/** 기회 점수 + pm_action_plan 기대효과 + 전략 인사이트로 메트릭 그리드 구성 */
export function buildOutcomeMetricItems(
  result: ResearchResponse | null,
  taskData?: Partial<Record<string, unknown>>,
  analysisTasks?: Array<{ step_name: string; output_data?: unknown }> | null
): OutcomeMetricItem[] {
  const km = result?.key_metrics
  const out: OutcomeMetricItem[] = []

  const opp =
    km && typeof km.opportunity_score === 'number' && Number.isFinite(km.opportunity_score)
      ? Math.round(km.opportunity_score)
      : null
  if (opp != null && km) {
    const basis =
      sanitizeForKoreanDisplay(
        (km.opportunity_score_summary_text ??
          km.opportunity_score_reason_text ??
          km.strategic_decision_layer?.market_opportunity_explanation) as string | undefined
      )?.trim() ?? ''
    out.push({
      value: `${opp.toLocaleString('ko-KR')}점`,
      label: '시장 기회 점수',
      basis: basis.length >= 8 ? truncate(basis, 140) : '통합 파이프라인·요약 근거로 산출된 최종 점수입니다.',
    })
  }

  const kmPlan = Array.isArray(km?.pm_action_plan) ? (km!.pm_action_plan as PlanRow[]) : []
  const exec = getTaskOutputRecord('execution_layer', taskData ?? {}, analysisTasks)
  const execPlan = Array.isArray(exec?.pm_action_plan) ? (exec.pm_action_plan as PlanRow[]) : []
  const plan = kmPlan.length > 0 ? kmPlan : execPlan

  for (const row of plan) {
    const title = (row.action_title ?? '').trim()
    if (!title) continue
    const ev = (row.expected_outcome ?? '').trim()
    const desc = (row.description ?? '').trim()
    out.push({
      value: ev ? truncate(ev, 36) : '정성 목표',
      label: truncate(title, 48),
      basis: desc ? truncate(desc, 100) : ev ? truncate(ev, 120) : '실행 단계(pm_action_plan) 기준',
    })
    if (out.length >= 6) break
  }

  const nextPmRaw = exec?.next_actions_pm
  const nextPm = Array.isArray(nextPmRaw)
    ? (nextPmRaw as Array<{ action?: string; why?: string; how_to_execute?: string; estimated_effort?: string }>)
    : []
  for (const n of nextPm) {
    if (out.length >= 6) break
    const act = (n.action ?? '').trim()
    if (!act) continue
    const why = (n.why ?? '').trim()
    const how = (n.how_to_execute ?? '').trim()
    const effort = (n.estimated_effort ?? '').trim()
    out.push({
      value: why ? truncate(why, 36) : '실행 과제',
      label: truncate(act, 48),
      basis: how ? truncate(how, 100) : effort ? `예상 공수: ${effort}` : 'execution_layer.next_actions_pm',
    })
  }

  const strat = getTaskOutputRecord('strategy_generation', taskData ?? {}, analysisTasks)
  const stratInsights = Array.isArray(strat?.key_strategic_insights)
    ? (strat!.key_strategic_insights as string[])
    : []
  const kmInsights = Array.isArray(km?.key_strategic_insights) ? (km!.key_strategic_insights as string[]) : []
  const lines = [...stratInsights, ...kmInsights]
    .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    .slice(0, 6)

  for (const line of lines) {
    if (out.length >= 6) break
    const clean = line.trim()
    if (clean.length < 6) continue
    const numToken = clean.match(/\d+(?:\.\d+)?%|\d+\s*\/\s*100|\d+점/)?.[0]
    out.push({
      value: numToken ?? '요약',
      label: truncate(clean, 44),
      basis: clean.length > 44 ? truncate(clean, 200) : '전략·인사이트 추출 단계 출력',
    })
  }

  return out.slice(0, 6)
}

/** `execution_layer` 태스크 완료, 또는 히스토리 로드처럼 태스크 행 없이 리포트만 있는 경우 */
export function isExecutionLayerComplete(
  analysisTasks: Array<{ step_name: string; status: string }> | null | undefined,
  result: ResearchResponse | null
): boolean {
  if (analysisTasks?.some((t) => t.step_name === 'execution_layer' && t.status === 'completed')) return true
  if (result?.reportId && (!analysisTasks || analysisTasks.length === 0)) return true
  return false
}

export function isExecutionLayerBusy(
  analysisTasks: Array<{ step_name: string; status: string }> | null | undefined
): boolean {
  const t = analysisTasks?.find((x) => x.step_name === 'execution_layer')
  return t?.status === 'running' || t?.status === 'pending'
}

export function isExecutionLayerFailed(
  analysisTasks: Array<{ step_name: string; status: string }> | null | undefined
): boolean {
  return analysisTasks?.some((t) => t.step_name === 'execution_layer' && t.status === 'failed') ?? false
}
