'use client'

import { FileDown, RefreshCw, Loader2, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StrategyEnginePipeline } from './dashboard/StrategyEnginePipeline'
import { ProductStrategySection } from './dashboard/ProductStrategySection'
import { PMActionPlanSection } from './dashboard/PMActionPlanSection'
import type { ResearchResponse } from '@/lib/stores/research-store'
import type { StreamingState } from '@/lib/types/analysis-modes'

type StrategicActionItem = {
  action?: string
  priority?: string
  expected_impact?: string
  risk_addressed?: string
}

type StrategicActions = {
  immediate?: StrategicActionItem[]
  mid_term?: StrategicActionItem[]
  risk_mitigation?: StrategicActionItem[]
}

type KeyMetricsWithStrategic = ResearchResponse['key_metrics'] & {
  strategic_actions?: StrategicActions
}

export interface PMDecisionDashboardProps {
  keyword: string
  result: ResearchResponse | null
  loading: boolean
  streamingState: StreamingState
  /** Consensus / strategic summary for Target users & Value proposition */
  consensusData?: {
    strategicSummary?: {
      summary?: string
      opportunity?: string
      threat?: string
      actionItems?: string[]
    }
  } | null
  /** 폴링에서 받은 진행 단계 (0-based). 스트리밍 없이 새 탭/새로고침 시 사용 */
  polledProgressStep?: number
  /** 시장 데이터 수집 결과 (타임라인 Step 1용) */
  newsList?: Array<{ title?: string; url?: string; publisher?: string }>
  /** Per-task partial data from backend (AI Analysis Console) */
  taskData?: Partial<Record<string, unknown>>
  onPrint?: () => void
  onSaveInsight?: () => void
  onReanalyze?: () => void
  onAbort?: () => void
  reanalyzing?: boolean
}

export function PMDecisionDashboard({
  keyword,
  result,
  loading,
  streamingState,
  polledProgressStep,
  newsList = [],
  taskData = {},
  onPrint,
  onSaveInsight,
  onReanalyze,
  reanalyzing = false,
  consensusData,
}: PMDecisionDashboardProps) {
  const km = (result?.key_metrics ?? {}) as KeyMetricsWithStrategic
  const strategicActions = km.strategic_actions
  const actionPhases = (() => {
    const phases: Array<{ week: string; items: string[] }> = []
    const imm = strategicActions?.immediate ?? []
    const mid = strategicActions?.mid_term ?? []
    const risk = strategicActions?.risk_mitigation ?? []
    const addItems = (arr: StrategicActionItem[]) =>
      arr
        .map((a) => (typeof a?.action === 'string' ? a.action.trim() : ''))
        .filter(Boolean)
    if (imm.length) phases.push({ week: 'Week 1', items: addItems(imm) })
    if (mid.length) phases.push({ week: 'Week 2', items: addItems(mid) })
    if (risk.length) phases.push({ week: 'Week 3', items: addItems(risk) })
    if (phases.length === 0) {
      const rec = km.pm_actions?.recommended_actions ?? []
      if (rec.length)
        phases.push({
          week: 'Recommended',
          items: rec
            .map((a) => (typeof a?.title === 'string' ? a.title : ''))
            .filter(Boolean),
        })
    }
    return phases
  })()

  const productStrategySummary = km.summary_insights ?? result?.keyConclusions?.[0] ?? ''
  const productStrategyOpportunities =
    km.positive_signals ?? result?.marketNews ?? []
  const productStrategyKeyConclusions =
    result?.keyConclusions ?? (result?.key_metrics?.keyConclusions as string[] | undefined) ?? []

  const currentStep =
    polledProgressStep != null && loading
      ? polledProgressStep
      : streamingState.status === 'running' || streamingState.status === 'streaming'
        ? streamingState.currentStep
        : streamingState.status === 'completed'
          ? 4
          : -1
  const stepId =
    streamingState.status === 'running' || streamingState.status === 'streaming'
      ? streamingState.stepId
      : undefined

  const isAnalyzing =
    loading ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming'

  const showTimeline = (result != null || isAnalyzing) && Boolean(keyword?.trim())

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* AI Product Strategy Engine - visual pipeline */}
      {showTimeline && (
        <StrategyEnginePipeline
          keyword={keyword}
          currentStep={currentStep}
          allCompleted={
            streamingState.status === 'completed' || (result != null && !isAnalyzing)
          }
          streamingStepId={stepId}
          taskData={taskData}
          newsList={newsList}
          result={result}
        />
      )}

      {/* Product Strategy */}
      <ProductStrategySection
        summary={productStrategySummary}
        opportunities={productStrategyOpportunities}
        keyConclusions={productStrategyKeyConclusions}
        targetUsers={
          (productStrategySummary || productStrategyOpportunities.length > 0)
            ? 'Early adopters'
            : undefined
        }
        valueProposition={consensusData?.strategicSummary?.opportunity ?? undefined}
        loading={loading && !productStrategySummary && productStrategyOpportunities.length === 0}
      />

      {/* PM Action Plan */}
      <PMActionPlanSection
        phases={actionPhases}
        loading={loading && actionPhases.length === 0}
      />

      <div className="flex flex-wrap gap-2 pt-4 border-t border-border/60">
        {onPrint && (
          <Button variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <FileDown className="h-4 w-4" />
            PDF
          </Button>
        )}
        {onSaveInsight && (
          <Button variant="outline" size="sm" onClick={onSaveInsight} className="gap-1.5">
            <Bookmark className="h-4 w-4" />
            인사이트로 저장
          </Button>
        )}
        {onReanalyze && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="gap-2"
          >
            {reanalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                재분석 중...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                다시 분석하기
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
