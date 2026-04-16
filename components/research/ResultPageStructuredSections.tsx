'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { motionConfig } from '@/lib/motion-config'
import {
  BarChart3,
  Lightbulb,
  TrendingUp,
  Users,
  Target,
  CheckSquare,
} from 'lucide-react'
import { ResultPageSection } from '@/components/research/ResultPageSection'
import { ResultSummaryCards } from '@/components/research/ResultSummaryCards'
import { OpportunityScoreBreakdown } from '@/components/research/OpportunityScoreBreakdown'
import { KeyMarketInsightsCard } from '@/components/research/KeyMarketInsightsCard'
import { StrategicDecisionLayer } from '@/components/research/StrategicDecisionLayer'
import { StrategyEvaluationSection } from '@/components/research/StrategyEvaluationSection'
import { NextActionsForPM } from '@/components/research/NextActionsForPM'
import { AnalysisResultSections } from '@/components/research/AnalysisResultSections'
import type { ResearchResponse } from '@/lib/stores/research-store'
import type { NewsItem } from '@/lib/stores/research-store'
import { MarkdownBody } from '@/components/ui/markdown-body'

export interface ResultPageStructuredSectionsProps {
  result: ResearchResponse | null
  displayResult?: ResearchResponse | null
  taskData?: Partial<Record<string, unknown>>
  analysisTasks?: Array<{
    step_name: string
    status: string
    output_data: unknown
  }> | null
  /** 스트리밍 중인데 아직 task 행이 없을 때 펼칠 섹션 (예: streamingState.stepId) */
  livePipelineStepId?: string | null
  consensusData?: {
    sentiment?: { score?: number; trend?: 'rising' | 'stable' | 'falling'; ratio?: unknown }
    strategicSummary?: { summary?: string; opportunity?: string; actionItems?: string[] }
  } | null
  newsList?: NewsItem[]
  loading?: boolean
  keyword?: string
  /** 부분 실패 시에도 마지막 기회 점수·근거 UI 유지 */
  analysisFailed?: boolean
}

const SECTION_IDS = {
  resultSummary: 'section-result-summary',
  marketSummary: 'section-market-summary',
  keyInsights: 'section-key-insights',
  marketTrends: 'section-market-trends',
  competitorLandscape: 'section-competitor-landscape',
  strategicRecommendations: 'section-strategic-recommendations',
  actionPlan: 'section-action-plan',
} as const

const sectionEntranceVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.55,
      ease: motionConfig.sectionEntrance.ease,
    },
  },
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      staggerDirection: 1,
    },
  },
}

/** 현재 파이프라인에서 실행 중인 단계 → 접힌 섹션 중 자동으로 펼칠 ID */
function mapPipelineStepToSectionId(step: string | undefined): string | null {
  if (!step) return null
  const m: Record<string, string> = {
    signal_layer: SECTION_IDS.resultSummary,
    article_extraction: SECTION_IDS.resultSummary,
    article_summary: SECTION_IDS.resultSummary,
    trend_analysis: SECTION_IDS.marketTrends,
    competition_analysis: SECTION_IDS.competitorLandscape,
    insight_extraction: SECTION_IDS.keyInsights,
    strategy_generation: SECTION_IDS.strategicRecommendations,
    execution_layer: SECTION_IDS.actionPlan,
    risk_opportunity: SECTION_IDS.strategicRecommendations,
    post_processing: SECTION_IDS.resultSummary,
    post_processing_key_metrics: SECTION_IDS.resultSummary,
    post_processing_creative: SECTION_IDS.resultSummary,
    post_processing_saving: SECTION_IDS.resultSummary,
    final_refining: SECTION_IDS.resultSummary,
  }
  return m[step] ?? null
}

/**
 * Structured result page with 6 collapsible sections for clear information hierarchy.
 * Users can quickly scan titles and expand sections of interest.
 */
export function ResultPageStructuredSections({
  result,
  displayResult,
  taskData = {},
  analysisTasks = null,
  consensusData,
  newsList = [],
  loading = false,
  keyword = '',
  livePipelineStepId = null,
}: ResultPageStructuredSectionsProps) {
  const effectiveResult = displayResult ?? result
  const hasResultData = !!(effectiveResult?.reportId ?? effectiveResult?.key_metrics)

  const runningTaskName = analysisTasks?.find(
    (t) => t.status === 'running' || t.status === 'processing'
  )?.step_name
  const autoExpandSectionId = useMemo(() => {
    const step = runningTaskName ?? (loading ? livePipelineStepId ?? undefined : undefined)
    return mapPipelineStepToSectionId(step)
  }, [runningTaskName, loading, livePipelineStepId])

  const [manualOpenId, setManualOpenId] = useState<string | null>(null)
  useEffect(() => {
    setManualOpenId(null)
  }, [runningTaskName, livePipelineStepId])

  const effectiveOpenId = manualOpenId ?? autoExpandSectionId

  const sectionProps = (id: string) => ({
    open: effectiveOpenId === id,
    onOpenChange: (next: boolean) => setManualOpenId(next ? id : null),
  })

  return (
    <motion.div
      className="space-y-3"
      role="region"
      aria-label="분석 결과"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
          id={SECTION_IDS.resultSummary}
          title="결과 요약"
          description="기회 점수, 핵심 결론, 요약을 한눈에 확인하세요."
          icon={<BarChart3 className="h-5 w-5" />}
          defaultOpen={false}
          {...sectionProps(SECTION_IDS.resultSummary)}
        >
          {hasResultData ? (
            <div className="space-y-6">
              <OpportunityScoreBreakdown
                score={effectiveResult?.key_metrics?.opportunity_score ?? null}
                loading={loading}
                breakdown={effectiveResult?.key_metrics?.opportunity_score_breakdown}
                useKoreanLabels
              />
              {(() => {
                const km = effectiveResult?.key_metrics
                const bg =
                  (typeof km?.background_rationale === 'string' && km.background_rationale.trim()) ||
                  (typeof km?.summary_insights === 'string' && km.summary_insights.trim()) ||
                  ''
                if (!bg) return null
                return (
                  <div className="rounded-xl border border-border/60 bg-card/50 p-4 sm:p-5">
                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2">배경 및 근거</h3>
                    <MarkdownBody className="text-sm">{bg}</MarkdownBody>
                  </div>
                )
              })()}
              <ResultSummaryCards
                result={effectiveResult}
                consensusData={consensusData}
                taskData={taskData}
                analysisTasks={analysisTasks}
                loading={loading}
              />
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20">
              결과 요약 데이터가 없습니다. 다른 탭에서 진행 중인 분석 결과를 확인하세요.
            </div>
          )}
        </ResultPageSection>
      </motion.div>

      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
        id={SECTION_IDS.marketSummary}
        title="시장 개요"
        description="전략적 의사결정과 시장 관점을 확인하세요."
        icon={<BarChart3 className="h-5 w-5" />}
        defaultOpen={false}
        {...sectionProps(SECTION_IDS.marketSummary)}
      >
        <div className="space-y-6">
          <StrategicDecisionLayer
            result={effectiveResult}
            loading={loading}
            keyword={keyword}
            embedded
          />
        </div>
      </ResultPageSection>
      </motion.div>

      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
        id={SECTION_IDS.keyInsights}
        title="핵심 인사이트"
        description="시장 매력도 해석, 주요 기회, 핵심 리스크, 전략적 시사점을 한눈에 파악하세요."
        icon={<Lightbulb className="h-5 w-5" />}
        defaultOpen={false}
        {...sectionProps(SECTION_IDS.keyInsights)}
      >
        <KeyMarketInsightsCard
          result={effectiveResult}
          taskData={taskData}
          analysisTasks={analysisTasks}
          newsList={newsList}
          consensusData={consensusData}
          loading={loading}
          keyword={keyword}
        />
      </ResultPageSection>
      </motion.div>

      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
        id={SECTION_IDS.marketTrends}
        title="시장 트렌드"
        description="성장 신호, 트렌드 동향, 시장 온도 분석입니다."
        icon={<TrendingUp className="h-5 w-5" />}
        defaultOpen={false}
        {...sectionProps(SECTION_IDS.marketTrends)}
      >
        <AnalysisResultSections
          result={result}
          taskData={taskData}
          analysisTasks={analysisTasks}
          consensusData={consensusData}
          loading={loading}
          keyword={keyword}
          layout="pm-analytics"
          sectionOnly="market-trends"
        />
      </ResultPageSection>
      </motion.div>

      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
        id={SECTION_IDS.competitorLandscape}
        title="경쟁 환경"
        description="주요 경쟁사, 포지셔닝, 시장 구조를 파악하세요."
        icon={<Users className="h-5 w-5" />}
        defaultOpen={false}
        {...sectionProps(SECTION_IDS.competitorLandscape)}
      >
        <AnalysisResultSections
          result={result}
          taskData={taskData}
          analysisTasks={analysisTasks}
          consensusData={consensusData}
          loading={loading}
          keyword={keyword}
          layout="pm-analytics"
          sectionOnly="competition"
        />
      </ResultPageSection>
      </motion.div>

      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
        id={SECTION_IDS.strategicRecommendations}
        title="전략 제안"
        description="리스크, 기회, SWOT, 제품 전략을 종합한 추천입니다."
        icon={<Target className="h-5 w-5" />}
        defaultOpen={false}
        {...sectionProps(SECTION_IDS.strategicRecommendations)}
      >
        <div className="space-y-6">
          <StrategyEvaluationSection result={effectiveResult} loading={loading} />
          <AnalysisResultSections
            result={result}
            taskData={taskData}
            analysisTasks={analysisTasks}
            consensusData={consensusData}
            loading={loading}
            keyword={keyword}
            layout="pm-analytics"
            sectionOnly="strategic"
          />
        </div>
      </ResultPageSection>
      </motion.div>

      <motion.div variants={sectionEntranceVariants}>
        <ResultPageSection
        id={SECTION_IDS.actionPlan}
        title="액션 플랜"
        description="PM이 바로 실행할 수 있는 우선순위 액션 목록입니다."
        icon={<CheckSquare className="h-5 w-5" />}
        defaultOpen={false}
        {...sectionProps(SECTION_IDS.actionPlan)}
      >
        <NextActionsForPM result={effectiveResult} taskData={taskData} analysisTasks={analysisTasks} loading={loading} embedded />
      </ResultPageSection>
      </motion.div>
    </motion.div>
  )
}
