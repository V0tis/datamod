'use client'

import { useState, useEffect } from 'react'
import { FileDown, RefreshCw, Loader2, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TimeAgo } from '@/components/time-ago'
import { DecisionSummaryBlock } from './DecisionSummaryBlock'
import { ReportMarketTemperature } from './ReportMarketTemperature'
import { InsightBlocks } from './InsightBlocks'
import { PMActionsSection } from './PMActionsSection'
import { MonitoringSection } from './MonitoringSection'
import { ProgressBanner } from './step-progress-tracker'
import { ReportMetadata } from './report-metadata'
import { InsightActions } from './insight-actions'
import type { ResearchResponse } from '@/lib/stores/research-store'
import { type AnalysisMode, type StreamingState, createIdleState } from '@/lib/types/analysis-modes'
import { cn } from '@/lib/utils'

const TARGET_LABELS: Record<string, string> = {
  product: '제품',
  company: '기업',
  market: '시장',
  person: '인물',
  policy: '정책',
  technology: '기술',
}

export interface ResultsReportViewProps {
  keyword: string
  result: ResearchResponse | null
  analysisStatus: 'queued' | 'analyzing' | 'completed' | 'failed'
  onPrint?: () => void
  onSaveInsight?: () => void
  onReanalyze?: () => void
  onAbort?: () => void
  onDeepenAnalysis?: (keyword: string) => Promise<void>
  onCompetitorReinterpret?: (keyword: string) => Promise<void>
  reanalyzing?: boolean
  progress?: string | null
  analysisMode?: AnalysisMode
  streamingState?: StreamingState
  /** Enable interactive action items */
  interactiveActions?: boolean
}

/** Full layout always renders. Each section handles its own loading. No monolithic result block. */
export function ResultsReportView({
  keyword,
  result,
  analysisStatus,
  onPrint,
  onSaveInsight,
  onReanalyze,
  onAbort,
  onDeepenAnalysis,
  onCompetitorReinterpret,
  reanalyzing = false,
  progress = null,
  analysisMode = 'deep',
  streamingState = createIdleState(),
  interactiveActions = true,
}: ResultsReportViewProps) {
  const isAnalyzing = analysisStatus === 'queued' || analysisStatus === 'analyzing'
  const [showLongMessage, setShowLongMessage] = useState(false)
  const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!isAnalyzing) return
    const t = setTimeout(() => setShowLongMessage(true), 5000)
    return () => clearTimeout(t)
  }, [isAnalyzing])

  useEffect(() => {
    if (streamingState.status === 'completed') {
      setRevealedSections(new Set(['summary', 'temperature', 'insights', 'actions', 'monitoring']))
    } else if (streamingState.status === 'running' || streamingState.status === 'streaming') {
      const step = streamingState.currentStep
      const sections = new Set<string>()
      if (step >= 0) sections.add('summary')
      if (step >= 1) sections.add('temperature')
      if (step >= 2) sections.add('insights')
      if (step >= 2) sections.add('actions')
      if (step >= 3) sections.add('monitoring')
      setRevealedSections(sections)
    }
  }, [streamingState])
  const km = result?.key_metrics ?? {}
  const consensus = result?.analysis_results
  const summaryText =
    (typeof consensus?.strategic_insight === 'string' && consensus.strategic_insight.trim())
      ? consensus.strategic_insight
      : (result?.key_metrics?.summary_insights ??
        (result?.key_metrics?.keyConclusions?.[0] ?? result?.keyConclusions?.[0]) ??
        '')
  const marketScore = km.market_temperature_score ?? km.sentiment ?? 50
  const trend: 'rising' | 'stable' | 'declining' =
    consensus?.sentiment != null
      ? consensus.sentiment > 0
        ? 'rising'
        : consensus.sentiment < 0
          ? 'declining'
          : 'stable'
      : typeof marketScore === 'number'
        ? marketScore > 50
          ? 'rising'
          : marketScore < 50
            ? 'declining'
            : 'stable'
        : 'stable'
  const confidence = typeof consensus?.confidence === 'number' ? consensus.confidence : km.confidence_score
  const targetLabel = km.analysis_target ? (TARGET_LABELS[km.analysis_target] ?? km.analysis_target) : null

  const isFullyLoaded = Boolean(result?.reportId)
  const loadingSummary = isAnalyzing && !(summaryText && summaryText !== '—')
  const loadingTemperature = isAnalyzing && km.market_temperature_score == null && !isFullyLoaded
  const hasInsights = (km.facts?.length ?? 0) + (km.hypotheses?.length ?? 0) + (km.inferences?.length ?? 0) > 0
  const loadingInsights = isAnalyzing && !hasInsights && !isFullyLoaded
  const loadingActions = isAnalyzing && !(km.pm_actions?.recommended_actions?.length ?? 0) && !isFullyLoaded
  const loadingMonitoring = isAnalyzing && !isFullyLoaded

  const SectionCard = ({
    id,
    children,
    className,
  }: {
    id: string
    children: React.ReactNode
    className?: string
  }) => {
    const isRevealed = revealedSections.has(id) || !isAnalyzing
    return (
      <div
        className={cn(
          'transition-all duration-500 ease-out',
          isRevealed
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none',
          className
        )}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Progress Banner */}
      {isAnalyzing && (
        <ProgressBanner
          mode={analysisMode}
          streamingState={streamingState}
          onAbort={onAbort}
          className="mb-6"
        />
      )}

      {showLongMessage && isAnalyzing && streamingState.status === 'idle' && (
        <p className="text-sm text-muted-foreground animate-in fade-in duration-300" role="status">
          시장 동향·경쟁사를 분석해 PM 관점 요약을 만들고 있어요
        </p>
      )}

      {/* Header: keyword, metadata */}
      <header className="pb-4 border-b border-border/60 space-y-3">
        <h1 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight break-words">
          &quot;{keyword}&quot;
        </h1>
        {isAnalyzing ? (
          <p className="text-muted-foreground text-sm">{progress ?? '분석 중'}</p>
        ) : (
          <ReportMetadata
            analysisDate={result?.updated_at}
            analysisMode={analysisMode}
            confidence={confidence ?? undefined}
            analysisTarget={km.analysis_target}
          />
        )}
      </header>

      {/* 1. Executive Summary (one-line, strong weight) */}
      <SectionCard id="summary">
        <DecisionSummaryBlock
          summary={summaryText || '—'}
          marketDirection={trend}
          interpretation={loadingSummary ? undefined : (marketScore >= 70 ? '시장 기회가 유의미합니다.' : marketScore <= 40 ? '리스크 관리가 권장됩니다.' : undefined)}
          loading={loadingSummary}
          executiveStyle={!loadingSummary}
        />
      </SectionCard>

      {/* 2. Market Temperature */}
      <SectionCard id="temperature">
        <ReportMarketTemperature
          score={loadingTemperature ? null : marketScore}
          trend={trend}
          positiveSignals={km.positive_signals ?? []}
          neutralSignals={km.neutral_signals ?? []}
          negativeRisks={km.negative_risks ?? []}
          showSparkline
          loading={loadingTemperature}
        />
      </SectionCard>

      {/* 3. Top 3 Key Insights */}
      <SectionCard id="insights">
        <InsightBlocks
          facts={km.facts ?? []}
          hypotheses={km.hypotheses ?? []}
          inferences={km.inferences ?? []}
          maxItems={3}
          loading={loadingInsights}
          labels="ko"
        />
      </SectionCard>

      {/* 4. Recommended Actions */}
      <SectionCard id="actions">
        <PMActionsSection
          actions={km.pm_actions?.recommended_actions ?? []}
          onReanalyze={onReanalyze}
          reanalyzing={reanalyzing}
          loading={loadingActions}
          interactive={interactiveActions && !isAnalyzing}
        />
      </SectionCard>

      {/* Things to Watch */}
      <SectionCard id="monitoring">
        <MonitoringSection items={km.pm_actions?.monitoring_points ?? []} loading={loadingMonitoring} />
      </SectionCard>

      {/* Insight Actions */}
      {!isAnalyzing && (onDeepenAnalysis || onCompetitorReinterpret) && (
        <SectionCard id="insight-actions">
          <InsightActions
            keyword={keyword}
            onDeepenAnalysis={onDeepenAnalysis}
            onCompetitorReinterpret={onCompetitorReinterpret}
            disabled={isAnalyzing}
          />
        </SectionCard>
      )}

      {/* Actions */}
      <div className="no-print flex flex-wrap gap-2 pt-4 border-t border-border/60">
        {onPrint && (
          <Button type="button" variant="outline" size="sm" onClick={onPrint} className="gap-1.5">
            <FileDown className="w-4 h-4" />
            PDF
          </Button>
        )}
        {onSaveInsight && (
          <Button type="button" variant="outline" size="sm" onClick={onSaveInsight} className="gap-1.5">
            <Bookmark className="w-4 h-4" />
            인사이트로 저장
          </Button>
        )}
        {onReanalyze && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onReanalyze}
            disabled={reanalyzing}
            className="gap-2"
          >
            {reanalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                재분석 중...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                다시 분석하기
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
