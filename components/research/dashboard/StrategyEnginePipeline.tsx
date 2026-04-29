'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { Check, Loader2, ChevronDown, ChevronUp, Sparkles, AlertCircle, AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { useResearchStore } from '@/lib/stores/research-store'
import {
  GlobalPipelineActivityStrip,
  PipelineStepActivityLog,
  filterLogsForStage,
  plainActivityPreview,
} from '@/components/research/dashboard/PipelineStepActivityLog'
import { getPhase2CompetitionRowStatus, getPhase2TrendRowStatus } from '@/lib/analysis/phase2-row-status'
import { getAnalysisActivityMessage } from '@/lib/analysis-activity-messages'
import { getAnalysisErrorMessage } from '@/lib/analysis-error-messages'
import { getProviderDisplayName, getProviderStatusKo } from '@/lib/ai/provider-display'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AnalysisProgressMeta } from '@/lib/types/analysis-modes'
import { NINE_PIPELINE_STAGES, STREAM_TO_NINE_INDEX } from '@/lib/analysis/pipeline-nine-stage'

const PIPELINE_TASK_KEYS = [
  'analysis_prep',
  'signal_layer',
  'article_extraction',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
  'risk_opportunity',
] as const

const PIPELINE_STAGES = NINE_PIPELINE_STAGES.map((meta, i) => ({
  id: meta.id,
  label: meta.label,
  subtitle: meta.subtitle,
  taskId: PIPELINE_TASK_KEYS[i],
})) as readonly {
  id: string
  label: string
  subtitle: string
  taskId: (typeof PIPELINE_TASK_KEYS)[number]
}[]

const STREAM_TO_INDEX = STREAM_TO_NINE_INDEX

export interface PipelineStageInsight {
  /** Section header (e.g. "Signals detected", "AI Insight") */
  sectionLabel?: string
  /** Main reasoning paragraph (AI Insight, strategy summary) */
  summary?: string
  /** Bullet points (signals, competitors, risks, actions) */
  signals?: string[]
  /** 수집된 시그널: 제목 + URL (클릭 시 원문 이동) */
  signalItems?: Array<{ title: string; url?: string }>
}

export interface StrategyEnginePipelineProps {
  keyword: string
  /** Backend current step (0–8). -1 = not started. */
  currentStep: number
  /** When true, all stages show as completed */
  allCompleted?: boolean
  streamingStepId?: string
  /** Current article title during article_extraction/article_summary (e.g. "기사 읽는 중: ...") */
  currentArticleTitle?: string
  /** Shown when retrying after 429 (e.g. "재시도 중...") */
  retryMessage?: string
  taskData?: Partial<Record<string, unknown>>
  /** Polled task status from backend (real state) */
  analysisTasks?: Array<{
    step_name: string
    status: 'pending' | 'running' | 'completed' | 'failed'
    output_data: unknown
    error_message: string | null
    provider?: string | null
    fallback_used?: boolean
    primary_provider_error?: string | null
  }> | null
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  /** 실패한 단계의 `taskId`를 넘기면 해당 단계만 재시도, 생략 시 상위에서 전체 재분석 등 처리 */
  onRetryStep?: (failedStepTaskId?: string) => void
  /** Global analysis failure - timeline stays visible, this step shows error */
  hasError?: boolean
  /** Step index (0–8) where global error occurred */
  errorStepIndex?: number
  /** Error message to show in failed step when task.error_message is empty */
  globalErrorMessage?: string
  /** Hero 내장 시 카드/박스 중첩 제거, 기회 점수 그리드와 시각적 통일 */
  embedded?: boolean
  /** 접이식 헤더와 중복되지 않게 상단 스파클 제목 행 숨김 */
  hidePipelineTitle?: boolean
  /** 에러 시 재시도 버튼·행 강조(접이식에서 자동 펼침과 함께 사용) */
  prominentFailedRetry?: boolean
  /** AI 우선 모델 (run/setting) - task.provider 없을 때 fallback. priority: step > run > setting */
  aiPrimaryModel?: 'gemini' | 'groq'
  /** reportId - 변경 시 타임라인 상태 초기화 (stale error 방지) */
  resultId?: string | null
  /** 스트리밍 중 진행 메타(최종 정제 문구 등) */
  streamingProgressMeta?: AnalysisProgressMeta | null
  /** 분석이 아직 끝나지 않았을 때(폴링/스트림) 큐 대기 배너 판별에 사용 */
  pipelineInFlight?: boolean
  result?: {
    marketNews?: string[]
    painPoints?: string[]
    competitorTrends?: string
    key_metrics?: {
      positive_signals?: string[]
      neutral_signals?: string[]
      negative_risks?: string[]
      summary_insights?: string
      pm_actions?: { recommended_actions?: Array<{ title?: string; reasoning?: string }> }
    }
  } | null
  className?: string
}

function mergeTaskOutput(
  taskMap: Record<string, { output_data?: unknown } | null | undefined>,
  taskData: Partial<Record<string, unknown>>,
  key: string
): Record<string, unknown> | null {
  const fromRow = taskMap[key]?.output_data
  const raw =
    fromRow && typeof fromRow === 'object' ? fromRow : taskData[key as keyof typeof taskData]
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
}

function getStageInsight(
  stageIndex: number,
  taskData: Partial<Record<string, unknown>>,
  taskMap: Record<string, { output_data?: unknown } | null | undefined>,
  result: StrategyEnginePipelineProps['result'],
  newsList: Array<{ title?: string; url?: string; publisher?: string }>
): PipelineStageInsight | null {
  const km = result?.key_metrics ?? {}

  if (stageIndex === 0) {
    return {
      sectionLabel: '준비',
      summary: '캐시 조회·데이터 정합성 확인 및 파이프라인 초기화가 완료되었습니다.',
      signals: ['분석 경로 확정', '외부 시그널 소스 연결'],
    }
  }

  const td =
    stageIndex === 2
      ? mergeTaskOutput(taskMap, taskData, 'article_extraction') ??
        mergeTaskOutput(taskMap, taskData, 'article_summary')
      : PIPELINE_STAGES[stageIndex]?.taskId
        ? mergeTaskOutput(taskMap, taskData, PIPELINE_STAGES[stageIndex].taskId as string)
        : null

  if (td && typeof td === 'object') {
    const obj = td as Record<string, unknown>
    const signals = Array.isArray(obj.signals)
      ? (obj.signals as string[]).filter((s) => typeof s === 'string')
      : undefined
    const news_activity = Array.isArray(obj.news_activity)
      ? (obj.news_activity as Array<{ title?: string; url?: string; publisher?: string }>)
      : []
    const trend_summary =
      typeof obj.trend_summary === 'string'
        ? obj.trend_summary
        : typeof obj.summary === 'string'
          ? obj.summary
          : undefined
    const growth_signals = Array.isArray(obj.growth_signals)
      ? (obj.growth_signals as string[]).filter((s) => typeof s === 'string')
      : Array.isArray(obj.insights)
        ? (obj.insights as string[]).filter((s) => typeof s === 'string')
        : undefined
    const competitive_landscape = Array.isArray(obj.competitive_landscape)
      ? obj.competitive_landscape
      : []
    const compSignals = competitive_landscape
      .slice(0, 8)
      .map((c) =>
        typeof c === 'object' && c && typeof (c as { name?: string }).name === 'string'
          ? (c as { name: string }).name
          : ''
      )
      .filter(Boolean)
    const opportunities = Array.isArray(obj.opportunities)
      ? (obj.opportunities as string[]).filter((s) => typeof s === 'string')
      : []
    const risks = Array.isArray(obj.risks)
      ? (obj.risks as string[]).filter((s) => typeof s === 'string')
      : []
    const strategy_summary =
      typeof obj.strategy_summary === 'string' ? obj.strategy_summary : undefined
    const product_actions = Array.isArray(obj.product_actions) ? obj.product_actions : []
    const actionSignals = product_actions
      .slice(0, 5)
      .map((a) =>
        typeof a === 'object' && a && typeof (a as { action?: string }).action === 'string'
          ? (a as { action: string }).action
          : ''
      )
      .filter(Boolean)
    const feature_ideas = Array.isArray(obj.feature_ideas)
      ? (obj.feature_ideas as string[]).filter((s) => typeof s === 'string')
      : []
    const go_to_market = Array.isArray(obj.go_to_market_steps)
      ? (obj.go_to_market_steps as string[]).filter((s) => typeof s === 'string')
      : []

    switch (stageIndex) {
      case 1: {
        // 시장 신호 수집: headlines + URL (클릭 시 원문 이동)
        const itemsWithUrl = news_activity
          .slice(0, 5)
          .map((n) => {
            const title = (n.title ?? '').trim().slice(0, 80)
            if (!title) return null
            const url = n.url ?? newsList.find((nl) => (nl.title ?? '').trim() === title)?.url
            return { title, url }
          })
          .filter((x): x is { title: string; url: string | undefined } => !!x)
        if (itemsWithUrl.length > 0) {
          return {
            sectionLabel: '수집된 시그널',
            summary: news_activity.length > 0
              ? `${news_activity.length}건 뉴스·시장 데이터 수집 완료`
              : undefined,
            signalItems: itemsWithUrl,
            signals: itemsWithUrl.map((x) => x.title),
          }
        }
        const sourceSignals = signals?.length ? signals : ['Google News', 'RSS 피드']
        return {
          sectionLabel: '수집된 시그널',
          summary: news_activity.length > 0
            ? `${news_activity.length}건 뉴스·시장 데이터 수집 완료`
            : undefined,
          signals: sourceSignals.slice(0, 5),
        }
      }
      case 2: {
        const na = Array.isArray(obj.news_activity) ? (obj.news_activity as unknown[]).length : 0
        const batch = Array.isArray((obj as { batch_titles?: unknown }).batch_titles)
          ? ((obj as { batch_titles: unknown[] }).batch_titles).length
          : 0
        const n = na || batch || 0
        const lines = Array.isArray(obj.insights)
          ? (obj.insights as string[]).filter((s): s is string => typeof s === 'string').slice(0, 4)
          : []
        return {
          sectionLabel: '기사 가공',
          summary: n > 0 ? `핵심 기사 ${n}건 추출·요약 반영` : '기사 본문 추출·요약이 반영되었습니다.',
          signals: lines.length > 0 ? lines : ['웹/RSS 시그널을 분석용 컨텍스트로 정제했습니다.'],
        }
      }
      case 3:
        return {
          sectionLabel: '시장 트렌드',
          summary: trend_summary,
          signals: growth_signals?.slice(0, 5),
        }
      case 4:
        return {
          sectionLabel: '감지된 경쟁사',
          summary: typeof obj.market_structure === 'string' ? obj.market_structure : undefined,
          signals: compSignals.slice(0, 6),
        }
      case 5: {
        const ki = Array.isArray((obj as { key_insights?: unknown }).key_insights)
          ? ((obj as { key_insights: unknown[] }).key_insights).filter((x): x is string => typeof x === 'string')
          : []
        const ins = Array.isArray(obj.insights)
          ? (obj.insights as string[]).filter((s): s is string => typeof s === 'string')
          : []
        const merged = [...ki, ...ins].slice(0, 6)
        return {
          sectionLabel: '핵심 인사이트',
          summary: merged.length ? `${merged.length}개 인사이트·시그널 도출` : strategy_summary,
          signals: merged.length ? merged : growth_signals?.slice(0, 5),
        }
      }
      case 6: {
        const execSignals6 = [
          ...actionSignals,
          ...feature_ideas.slice(0, 3),
          ...go_to_market.slice(0, 2),
        ].filter(Boolean)
        const strategySummaryLine = actionSignals[0]
          ? `초기 수용자 타겟: ${actionSignals[0]}`
          : feature_ideas[0]
            ? `Core value: ${feature_ideas[0]}`
            : execSignals6.length > 0
              ? `${execSignals6.length}개 전략 가설 도출`
              : undefined
        return {
          sectionLabel: '전략 가설',
          summary: strategySummaryLine ?? strategy_summary,
          signals: execSignals6.slice(0, 5),
        }
      }
      case 7: {
        const pa = Array.isArray(obj.product_actions) ? obj.product_actions : []
        const titles = pa
          .slice(0, 6)
          .map((a) =>
            typeof a === 'object' && a && typeof (a as { action?: string }).action === 'string'
              ? (a as { action: string }).action
              : ''
          )
          .filter(Boolean)
        return {
          sectionLabel: 'PM 액션',
          summary: titles.length ? `${titles.length}개 실행 과제 정리` : undefined,
          signals: titles.length ? titles : go_to_market.slice(0, 5),
        }
      }
      case 8:
        return {
          sectionLabel: '리스크·기회 검증',
          summary: strategy_summary,
          signals: [...risks.slice(0, 3), ...opportunities.slice(0, 3)].filter(Boolean).slice(0, 6),
        }
    }
  }

  // Fallback from result (history load)
  switch (stageIndex) {
    case 0:
      return {
        sectionLabel: '준비',
        summary: '저장된 리포트에서 분석 경로가 복원되었습니다.',
        signals: ['캐시/히스토리 기준'],
      }
    case 1:
      if (newsList.length > 0) {
        const signalItems = newsList
          .slice(0, 5)
          .map((n) => {
            const title = (n.title ?? '').trim().slice(0, 80)
            if (!title) return null
            return { title, url: n.url }
          })
          .filter((x): x is { title: string; url: string | undefined } => !!x)
        if (signalItems.length > 0) {
          return {
            sectionLabel: '수집된 시그널',
            summary: `${newsList.length}건 시장 데이터 수집`,
            signalItems,
            signals: signalItems.map((x) => x.title),
          }
        }
        const publishers = [...new Set(newsList.map((n) => n.publisher).filter(Boolean))].slice(0, 5) as string[]
        return {
          sectionLabel: '수집된 시그널',
          summary: `${newsList.length}건 시장 데이터 수집`,
          signals: publishers.length ? publishers : ['Google News', 'RSS 피드'],
        }
      }
      return null
    case 2:
      return {
        sectionLabel: '기사 가공',
        summary: newsList.length ? `수집된 ${newsList.length}건 기준 요약·추출 반영` : '기사 요약·추출 단계가 반영되었습니다.',
        signals: ['히스토리 로드'],
      }
    case 3:
      return {
        sectionLabel: '시장 트렌드',
        summary: km.summary_insights ?? result?.marketNews?.[0],
        signals: (km.positive_signals ?? result?.marketNews ?? []).slice(0, 4),
      }
    case 4:
      return {
        sectionLabel: '감지된 경쟁사',
        summary: result?.competitorTrends,
        signals: (km.neutral_signals ?? []).slice(0, 4),
      }
    case 5: {
      const pos = km.positive_signals ?? []
      const neg = km.negative_risks ?? result?.painPoints ?? []
      return {
        sectionLabel: '핵심 인사이트',
        summary: pos.length || neg.length ? `${pos.length}개 기회 신호, ${neg.length}개 리스크 신호` : undefined,
        signals: [...neg.slice(0, 4), ...pos.slice(0, 2)].filter(Boolean),
      }
    }
    case 6: {
      const actions = km.pm_actions?.recommended_actions ?? []
      return {
        sectionLabel: '전략 가설',
        summary: actions.length ? `${actions.length}개 전략 액션 도출` : undefined,
        signals: actions.slice(0, 4).map((a) => a?.title ?? '').filter(Boolean),
      }
    }
    case 7: {
      const kmx = km as Record<string, unknown>
      const plan = Array.isArray(kmx.pm_action_plan) ? (kmx.pm_action_plan as Array<{ action_title?: string }>) : []
      const titles = plan
        .map((p: { action_title?: string }) =>
          typeof p.action_title === 'string' ? p.action_title : ''
        )
        .filter(Boolean)
      return {
        sectionLabel: 'PM 액션',
        summary: titles.length ? `${titles.length}개 실행 과제` : undefined,
        signals: titles.slice(0, 5),
      }
    }
    case 8: {
      const pos5 = km.positive_signals ?? []
      const neg5 = km.negative_risks ?? result?.painPoints ?? []
      const se = (km as { strategy_evaluation?: { cross_validation_score?: number } }).strategy_evaluation
      const cv = typeof se?.cross_validation_score === 'number' ? `교차검증 ${se.cross_validation_score}%` : undefined
      return {
        sectionLabel: '리스크·기회 검증',
        summary: cv ?? (pos5.length || neg5.length ? `${pos5.length}개 기회, ${neg5.length}개 리스크` : undefined),
        signals: [...neg5.slice(0, 3), ...pos5.slice(0, 3)].filter(Boolean),
      }
    }
  }

  return null
}

export function StrategyEnginePipeline({
  keyword,
  currentStep,
  allCompleted = false,
  streamingStepId,
  currentArticleTitle,
  retryMessage,
  taskData = {},
  analysisTasks = null,
  newsList = [],
  onRetryStep,
  hasError = false,
  errorStepIndex = 0,
  globalErrorMessage,
  result,
  embedded = false,
  hidePipelineTitle = false,
  prominentFailedRetry = false,
  aiPrimaryModel = 'gemini',
  resultId,
  streamingProgressMeta = null,
  pipelineInFlight = false,
  className,
}: StrategyEnginePipelineProps) {
  /** 단계별 '분석 결과' 카드 펼침 — 분석 완료 후 사용자가 연 경우에만 true */
  const [insightOpen, setInsightOpen] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setInsightOpen({})
  }, [resultId])

  const globalStripRef = useRef<HTMLDivElement>(null)

  type TaskItem = NonNullable<typeof analysisTasks> extends (infer U)[] ? U : never
  const taskMap = (analysisTasks ?? []).reduce(
    (acc, t) => { acc[t.step_name] = t; return acc },
    {} as Record<string, TaskItem>
  )

  const effectiveIndex = allCompleted
    ? 8
    : streamingStepId === 'competition_analysis' && taskMap['trend_analysis']?.status !== 'completed'
      ? 3
      : streamingStepId && STREAM_TO_INDEX[streamingStepId] != null
        ? STREAM_TO_INDEX[streamingStepId]
        : currentStep >= 0
          ? currentStep
          : 0

  const [stepStartTime, setStepStartTime] = useState(0)
  const [tickTime, setTickTime] = useState(0)
  useEffect(() => {
    setStepStartTime(Date.now())
  }, [effectiveIndex])
  useEffect(() => {
    const id = setInterval(() => setTickTime(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const stepElapsedMs = tickTime - stepStartTime

  type StageStatus = 'pending' | 'running' | 'completed' | 'failed'
  function getStatus(i: number): StageStatus {
    const stage = PIPELINE_STAGES[i]
    const taskId = stage?.taskId
    const task = taskId && taskId !== 'analysis_prep' ? taskMap[taskId] : null
    const failIdx = hasError ? Math.min(errorStepIndex, 8) : -1
    if (hasError && failIdx >= 0 && i === failIdx) return 'failed'

    const sig = taskMap['signal_layer']
    const artEx = taskMap['article_extraction']
    const artSum = taskMap['article_summary']

    if (i === 0) {
      if (!pipelineInFlight && !sig) return 'pending'
      if (!sig) return 'running'
      if (sig.status === 'pending') return 'running'
      return 'completed'
    }

    if (i === 1) {
      if (task && task.status) {
        if (task.status === 'failed') return 'failed'
        if (task.status === 'completed') return 'completed'
        if (task.status === 'running') return 'running'
        return 'pending'
      }
      if (hasError && failIdx >= 0) {
        if (i === failIdx) return 'failed'
        if (i < failIdx) return 'completed'
        return 'pending'
      }
      if (i < effectiveIndex) return 'completed'
      if (i === effectiveIndex && !allCompleted) return 'running'
      return 'pending'
    }

    if (i === 2) {
      if (sig?.status !== 'completed' && sig?.status !== 'failed') return 'pending'
      const articleRunning =
        streamingStepId === 'article_extraction' ||
        streamingStepId === 'article_summary' ||
        artEx?.status === 'running' ||
        artSum?.status === 'running'
      if (articleRunning) return 'running'
      if (!artEx && !artSum) return 'completed'
      const exDone = !artEx || artEx.status === 'completed' || artEx.status === 'failed'
      const smDone = !artSum || artSum.status === 'completed' || artSum.status === 'failed'
      if (exDone && smDone && (artEx?.status === 'completed' || artSum?.status === 'completed' || (!artEx && !artSum)))
        return 'completed'
      if (exDone && smDone) return 'completed'
      return 'pending'
    }

    if (i === 3) return getPhase2TrendRowStatus(taskMap['trend_analysis'])
    if (i === 4) return getPhase2CompetitionRowStatus(taskMap['trend_analysis'], taskMap['competition_analysis'])

    if (task && task.status && i >= 5 && i <= 7) {
      if (task.status === 'failed') return 'failed'
      if (task.status === 'completed') return 'completed'
      if (task.status === 'running') return 'running'
      return 'pending'
    }

    if (i === 8) {
      const riskTask = taskMap['risk_opportunity']
      if (riskTask) return riskTask.status
      if (
        result?.key_metrics != null &&
        typeof (result.key_metrics as { opportunity_score?: unknown }).opportunity_score === 'number'
      )
        return 'completed'
      const isPostProcessing =
        streamingStepId &&
        (streamingStepId.startsWith('post_processing_') ||
          streamingStepId === 'post_processing' ||
          streamingStepId === 'final_refining')
      return allCompleted ? 'completed' : isPostProcessing ? 'running' : 'pending'
    }

    if (hasError && failIdx >= 0) {
      if (i === failIdx) return 'failed'
      if (i < failIdx) return 'completed'
      return 'pending'
    }
    if (i < effectiveIndex) return 'completed'
    if (i === effectiveIndex && !allCompleted) return 'running'
    return 'pending'
  }

  const queueWaitingBanner = (() => {
    if (!pipelineInFlight || allCompleted) return false
    const statuses = PIPELINE_STAGES.map((_, i) => getStatus(i))
    if (statuses.some((s) => s === 'running')) return false
    for (let i = 1; i < statuses.length; i++) {
      if (statuses[i - 1] === 'completed' && statuses[i] === 'pending') return true
    }
    return false
  })()

  const streamingActivityLog = useResearchStore((s) => s.streamingActivityLog)
  const activityRows = useMemo(
    () =>
      streamingActivityLog.map((r) => ({
        ts: r.ts,
        message: r.message,
        kind: r.kind,
        type: r.type,
        stepId: r.stepId,
      })),
    [streamingActivityLog]
  )

  return (
    <div
      className={cn(
        !embedded &&
          'rounded-[12px] border border-zinc-200/90 bg-zinc-50/50 shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden  ',
        className
      )}
    >
      <div className={cn('flex flex-col gap-4', embedded ? 'py-2' : 'p-5 sm:p-6')}>
        {!hidePipelineTitle ? (
          <div className={cn('flex items-center gap-2 min-w-0', embedded ? '' : 'pb-0.5 border-b border-slate-200/70 ')}>
            <Sparkles className="h-4 w-4 text-slate-600  shrink-0" />
            <div className="min-w-0">
              <span className={cn(embedded ? 'text-xs font-medium text-muted-foreground' : 'text-sm font-semibold tracking-tight text-slate-800 ')}>
                {allCompleted ? `분석 완료 · "${keyword}"` : `분석 파이프라인 · "${keyword}"`}
              </span>
            </div>
          </div>
        ) : null}

        <div className="relative">
          <GlobalPipelineActivityStrip logs={activityRows} stripRef={globalStripRef} />
          {queueWaitingBanner ? (
            <div
              className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/95 px-3 py-2.5 text-xs leading-snug text-sky-950   "
              role="status"
              aria-live="polite"
            >
              <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-sky-600 " aria-hidden />
              <div>
                <p className="font-semibold text-sky-950 ">다음 분석 준비 중…</p>
                <p className="mt-0.5 text-[11px] text-sky-900/90 ">
                  큐 대기 중이거나 서버가 다음 단계를 배정하는 중입니다. 실시간 상태와 함께 곧 이어집니다.
                </p>
              </div>
            </div>
          ) : null}
          {/* 9단계 요약 스텝 인디케이터 */}
          <div
            className="mb-5 grid gap-2 sm:gap-3"
            style={{ gridTemplateColumns: 'repeat(9, minmax(0, 1fr))' }}
            aria-label="분석 파이프라인 9단계 진행"
          >
            {PIPELINE_STAGES.map((st, j) => {
              const stStatus = getStatus(j)
              return (
                <div key={st.id} className="flex flex-col items-center gap-1 min-w-0 text-center">
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums shadow-sm ring-1 transition-colors',
                      stStatus === 'completed' &&
                        'bg-zinc-100 text-zinc-700 ring-zinc-200   ',
                      stStatus === 'running' &&
                        'bg-primary text-primary-foreground ring-primary/35 shadow-md',
                      stStatus === 'pending' && 'bg-zinc-50 text-zinc-400 ring-zinc-200/80  ',
                      stStatus === 'failed' && 'bg-red-50 text-red-700 ring-red-200  ',
                    )}
                  >
                    {j + 1}
                  </span>
                  <span className="hidden sm:block text-[9px] font-medium leading-tight text-zinc-500  truncate max-w-full px-0.5">
                    {st.label}
                  </span>
                </div>
              )
            })}
          </div>

          {PIPELINE_STAGES.map((stage, i) => {
            const status = getStatus(i)
            const taskKey = stage.taskId === 'analysis_prep' ? 'signal_layer' : stage.taskId
            const insight =
              status === 'completed' ? getStageInsight(i, taskData, taskMap, result, newsList) : null
            const hasInsight = insight && (insight.summary || (insight.signals?.length ?? 0) > 0)
            const showInsightPanel = Boolean(hasInsight && status === 'completed')
            const task = (i === 0 ? taskMap['signal_layer'] : taskMap[taskKey]) ?? null
            const retryStepId = stage.taskId === 'analysis_prep' ? 'signal_layer' : taskKey

            const isError = status === 'failed'
            const stageLogs = filterLogsForStage(activityRows, i)

            return (
              <div
                key={stage.id}
                className={cn(
                  'relative border-l-2 pl-5 pb-8 last:pb-2',
                  !isError && 'border-slate-200 ',
                  isError &&
                    'rounded-r-lg border-red-300/90 bg-red-50/70  ',
                  isError && prominentFailedRetry && 'ring-2 ring-red-500/45 shadow-md ',
                )}
              >
                <div className="absolute -left-[9px] top-1.5 z-[1]" aria-hidden>
                  {status === 'completed' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-background ring-4 ring-background   ">
                      <Check className="h-2.5 w-2.5 text-slate-500" strokeWidth={3} />
                    </span>
                  )}
                  {status === 'running' && (
                    <span className="flex h-3 w-3 items-center justify-center">
                      <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_0_6px_rgba(59,130,246,0.2)] animate-pulse" />
                    </span>
                  )}
                  {status === 'pending' && (
                    <span className="block h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-background  " />
                  )}
                  {status === 'failed' && (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-red-200 bg-red-50 ring-4 ring-background   ">
                      <AlertCircle className="h-2.5 w-2.5 text-red-600 " strokeWidth={2.5} />
                    </span>
                  )}
                </div>

                <div className="min-w-0 pt-0.5">
                  <div
                    className={cn(
                      'text-sm font-semibold leading-snug',
                      status === 'completed' && 'text-slate-500 ',
                      status === 'running' && 'text-foreground',
                      status === 'pending' && 'text-muted-foreground',
                      status === 'failed' && 'text-red-800 ',
                    )}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="tracking-tight">{stage.label}</span>
                        <span className="text-[11px] font-normal text-zinc-500 ">
                          {status === 'completed' && '완료'}
                          {status === 'running' && '진행 중'}
                          {status === 'pending' && '대기'}
                          {status === 'failed' && '실패'}
                        </span>
                      </div>
                      <p className="text-[11px] font-normal leading-snug text-zinc-500 ">
                        {stage.subtitle}
                      </p>
                      {status === 'completed' && insight?.summary ? (
                        <p className="mt-1 rounded-md border border-zinc-200/90 bg-white/90 px-2.5 py-1.5 text-xs font-medium leading-snug text-zinc-800 shadow-sm   ">
                          {insight.summary}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {status !== 'pending' && (
                    <div className="text-[11px] font-medium text-muted-foreground mt-1 uppercase tracking-wider whitespace-pre-line">
                      모델 상태:{' '}
                      {(() => {
                        const t = task as { provider?: string | null; fallback_used?: boolean; primary_provider_error?: string | null } | null
                        const provider = t?.provider ?? aiPrimaryModel
                        if (t?.fallback_used && t?.primary_provider_error) {
                          const primary = provider === 'groq' ? 'Gemini' : 'Groq'
                          const fallback = provider === 'groq' ? 'Groq' : 'Gemini'
                          return getProviderStatusKo(primary, fallback, true, t.primary_provider_error, status === 'completed' ? 'completed' : 'running')
                        }
                        return getProviderDisplayName(provider, t?.fallback_used, t?.primary_provider_error) || (provider ? (provider === 'groq' ? 'Groq' : 'Gemini') : '—')
                      })()}
                      {' · '}
                      분석 상태: {status === 'completed' ? '완료' : status === 'running' ? '실행 중' : status === 'failed' ? '실패' : '대기'}
                    </div>
                  )}

                  {status === 'running' && (
                    <div className="mt-1.5 space-y-1.5">
                      {(task as { fallback_used?: boolean; primary_provider_error?: string | null } | null)?.fallback_used &&
                      (task as { primary_provider_error?: string | null })?.primary_provider_error ? (
                        <>
                          <div className="flex items-center gap-1.5 text-amber-700 ">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs font-medium">
                              {((task as { provider?: string }).provider ?? aiPrimaryModel) === 'groq' ? 'Gemini' : 'Groq'}{' '}
                              {(() => {
                                const err = (task as { primary_provider_error?: string }).primary_provider_error
                                return err === 'quota exceeded'
                                  ? '쿼터 초과'
                                  : err === 'timeout'
                                    ? '타임아웃'
                                    : err === 'network error'
                                      ? '네트워크 오류'
                                      : err?.replace(/_/g, ' ') ?? ''
                              })()}
                            </span>
                          </div>
                          <div className="flex items-start gap-2 text-xs text-slate-600 ">
                            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 mt-0.5" aria-hidden />
                            <span>
                              {((task as { provider?: string }).provider ?? aiPrimaryModel) === 'groq' ? 'Groq' : 'Gemini'}로 재시도 중...
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-start gap-2 min-w-0">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500 shrink-0 mt-0.5" aria-hidden />
                          <span className="text-[11px] leading-snug text-slate-600  line-clamp-2 min-w-0">
                            {(() => {
                              const lastEntry = stageLogs[stageLogs.length - 1]
                              if (lastEntry?.message) return plainActivityPreview(lastEntry.message, 180)
                              if (retryMessage && i === effectiveIndex) return retryMessage
                              const stepForMsg =
                                i === 0
                                  ? 'analysis_prep'
                                  : i === effectiveIndex
                                    ? (streamingStepId ?? stage.id)
                                    : stage.id
                              return getAnalysisActivityMessage(stepForMsg, i, {
                                short: true,
                                elapsedMs: i === effectiveIndex ? stepElapsedMs : undefined,
                                currentArticleTitle: i === effectiveIndex ? currentArticleTitle : undefined,
                                progressMeta: i === effectiveIndex ? streamingProgressMeta ?? undefined : undefined,
                              })
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {status === 'failed' && (() => {
                    const rawError =
                      (task as { error_message?: string } | null)?.error_message?.trim() ||
                      globalErrorMessage?.trim() ||
                      ''
                    const fallbackCopy = '데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
                    const rawForParse = rawError || fallbackCopy
                    const { description, recoveryHint, possibleCauses, variant: errVariant } = getAnalysisErrorMessage(rawForParse)
                    const isQuota = errVariant === 'quota'
                    return (
                      <div className="mt-2 space-y-2" role="alert">
                        <div className="text-sm font-medium text-foreground">
                          {rawError ? '분석 단계에서 오류가 발생했습니다' : '데이터를 불러오지 못했습니다'}
                        </div>
                        {description ? <div className="text-xs text-muted-foreground">{description}</div> : null}
                        {recoveryHint ? <div className="text-xs text-muted-foreground">{recoveryHint}</div> : null}
                        {possibleCauses && possibleCauses.length > 0 && (
                          <div>
                            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">가능한 원인</div>
                            <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                              {possibleCauses.map((cause, j) => (
                                <li key={j}>{cause}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {onRetryStep && (
                            <Button
                              variant={prominentFailedRetry ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => onRetryStep(retryStepId || undefined)}
                              className={cn(
                                'gap-1.5 h-9 text-xs font-medium',
                                prominentFailedRetry
                                  ? 'shadow-sm'
                                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50    '
                              )}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              {prominentFailedRetry ? '재시도' : '이 단계만 재시도'}
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-xs">
                            <Link href="/">
                              <Home className="h-3.5 w-3.5" />
                              대시보드로
                            </Link>
                          </Button>
                          {isQuota && (
                            <Button variant="ghost" size="sm" asChild className="gap-1.5 h-8 text-xs">
                              <Link href="/settings">설정으로 이동</Link>
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  <PipelineStepActivityLog logs={stageLogs} status={status} previewCount={3} compact />

                  {showInsightPanel && insight && (
                    <div className="mt-3 border-t border-slate-100 pt-3 ">
                      <button
                        type="button"
                        onClick={() => setInsightOpen((o) => ({ ...o, [i]: !o[i] }))}
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-200/90 bg-white/70 px-3 py-2 text-left text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50/90    "
                      >
                        <span>분석 결과</span>
                        {insightOpen[i] ? (
                          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
                        )}
                      </button>
                      {insightOpen[i] ? (
                        <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-3 space-y-2.5  ">
                            {insight.sectionLabel ? (
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 ">
                                {insight.sectionLabel}
                              </div>
                            ) : null}
                            {insight.summary ? (
                              <div className="text-sm text-foreground leading-relaxed">{insight.summary}</div>
                            ) : null}
                            {(insight.signalItems?.length ?? 0) > 0 ? (
                              <ul className="space-y-1">
                                {insight.signalItems!.map((item, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                                    <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                    {item.url ? (
                                      <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-slate-700 underline-offset-2 hover:underline truncate max-w-full "
                                      >
                                        {item.title}
                                      </a>
                                    ) : (
                                      <span>{item.title}</span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : insight.signals && insight.signals.length > 0 ? (
                              <ul className="space-y-1">
                                {insight.signals.map((s, j) => (
                                  <li key={j} className="flex items-start gap-2 text-sm text-foreground">
                                    <span className="text-slate-400 shrink-0 mt-0.5">•</span>
                                    <span>{s}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
