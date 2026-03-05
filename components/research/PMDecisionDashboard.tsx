'use client'

import { useEffect, useState } from 'react'
import { FileDown, RefreshCw, Loader2, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketSnapshot } from './dashboard/MarketSnapshot'
import { MarketDrivers } from './dashboard/MarketDrivers'
import { MarketSignals } from './dashboard/MarketSignals'
import { RisksPanel } from './dashboard/RisksPanel'
import { OpportunitiesPanel } from './dashboard/OpportunitiesPanel'
import { ActionPlanTimeline } from './dashboard/ActionPlanTimeline'
import { AnalysisProgress, STREAM_STEP_MAP } from './dashboard/AnalysisProgress'
import { cn } from '@/lib/utils'
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
  onPrint?: () => void
  onSaveInsight?: () => void
  onReanalyze?: () => void
  onAbort?: () => void
  reanalyzing?: boolean
}

function deriveTrend(score: number | null): 'rising' | 'stable' | 'declining' {
  if (score == null) return 'stable'
  if (score > 55) return 'rising'
  if (score < 45) return 'declining'
  return 'stable'
}

export function PMDecisionDashboard({
  keyword,
  result,
  loading,
  streamingState,
  onPrint,
  onSaveInsight,
  onReanalyze,
  reanalyzing = false,
}: PMDecisionDashboardProps) {
  const [revealedSections, setRevealedSections] = useState<Set<string>>(new Set())

  const km = (result?.key_metrics ?? {}) as KeyMetricsWithStrategic
  const score =
    km.market_temperature_score ??
    km.sentiment ??
    result?.sentiment ??
    null
  const trend = deriveTrend(typeof score === 'number' ? score : null)
  const signalCount =
    (km.positive_signals?.length ?? 0) +
    (km.neutral_signals?.length ?? 0) +
    (km.negative_risks?.length ?? 0)
  const confidence =
    typeof km.confidence_score === 'number'
      ? Math.round(km.confidence_score * 100)
      : result?.analysis_results?.confidence ?? null

  const drivers: string[] = (km.positive_signals ?? result?.marketNews ?? [])
    .slice(0, 3)
    .filter(Boolean)

  const risks: string[] = km.negative_risks ?? result?.painPoints ?? []

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

  const opportunities = (() => {
    const out: Array<{ title: string; description?: string; reason?: string }> = []
    const imm = strategicActions?.immediate ?? []
    const mid = strategicActions?.mid_term ?? []
    for (const a of [...imm, ...mid].slice(0, 3)) {
      if (typeof a?.action === 'string' && a.action.trim())
        out.push({
          title: a.action.trim(),
          description: a.expected_impact,
        })
    }
    if (out.length === 0) {
      const rec = km.pm_actions?.recommended_actions ?? []
      for (const a of rec.slice(0, 3)) {
        if (typeof a?.title === 'string' && a.title.trim())
          out.push({
            title: a.title,
            description: a.reasoning,
          })
      }
    }
    return out
  })()

  const signals = (() => {
    const items: Array<{
      label: string
      value?: string
      trend: 'rising' | 'stable' | 'declining'
      status?: 'positive' | 'neutral' | 'negative'
    }> = []
    const pos = km.positive_signals ?? []
    const neu = km.neutral_signals ?? []
    const neg = km.negative_risks ?? []
    pos.slice(0, 2).forEach((s) =>
      items.push({ label: s, trend: 'rising', status: 'positive' })
    )
    neu.slice(0, 2).forEach((s) =>
      items.push({ label: s, trend: 'stable', status: 'neutral' })
    )
    neg.slice(0, 2).forEach((s) =>
      items.push({ label: s, trend: 'declining', status: 'negative' })
    )
    if (items.length === 0) {
      if (result?.marketNews?.length)
        items.push({ label: '시장 뉴스', trend: 'rising', status: 'positive' })
      if (result?.painPoints?.length)
        items.push({ label: '페인포인트', trend: 'declining', status: 'negative' })
      if (result?.competitorTrends)
        items.push({ label: '경쟁사 동향', trend: 'stable', status: 'neutral' })
    }
    return items
  })()

  const currentStep =
    streamingState.status === 'running' || streamingState.status === 'streaming'
      ? streamingState.currentStep
      : streamingState.status === 'completed'
        ? 4
        : -1
  const stepId =
    streamingState.status === 'running' || streamingState.status === 'streaming'
      ? streamingState.stepId
      : undefined

  useEffect(() => {
    if (loading) {
      const mapped =
        stepId && STREAM_STEP_MAP[stepId] != null
          ? STREAM_STEP_MAP[stepId]
          : currentStep
      const sections = new Set<string>()
      if (mapped >= 0) sections.add('snapshot')
      if (mapped >= 1) sections.add('drivers')
      if (mapped >= 2) {
        sections.add('signals')
        sections.add('risks')
        sections.add('opportunities')
        sections.add('actionPlan')
      }
      setRevealedSections(sections)
    } else {
      setRevealedSections(
        new Set([
          'snapshot',
          'drivers',
          'signals',
          'risks',
          'opportunities',
          'actionPlan',
        ])
      )
    }
  }, [loading, currentStep, stepId])

  const isAnalyzing =
    loading ||
    streamingState.status === 'running' ||
    streamingState.status === 'streaming'

  const showSection = (id: string) =>
    revealedSections.has(id) || !isAnalyzing

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {isAnalyzing && (
        <AnalysisProgress currentStep={currentStep} streamingStepId={stepId} />
      )}

      {/* Top: MarketSnapshot */}
      <div
        className={cn(
          'transition-all duration-500',
          showSection('snapshot')
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
        )}
      >
        <MarketSnapshot
          score={typeof score === 'number' ? score : null}
          trend={trend}
          signalCount={signalCount}
          confidence={confidence}
          loading={loading && !result?.reportId}
        />
      </div>

      {/* Two-column layout */}
      <div
        className={cn(
          'transition-all duration-500',
          showSection('drivers') ||
            showSection('signals') ||
            showSection('risks') ||
            showSection('opportunities')
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6">
            {showSection('drivers') && (
              <MarketDrivers
                drivers={drivers}
                loading={loading && drivers.length === 0}
              />
            )}
            {showSection('risks') && (
              <RisksPanel
                risks={risks}
                loading={loading && risks.length === 0}
              />
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {showSection('signals') && (
              <MarketSignals
                signals={signals}
                loading={loading && signals.length === 0}
              />
            )}
            {showSection('opportunities') && (
              <OpportunitiesPanel
                opportunities={opportunities}
                loading={loading && opportunities.length === 0}
              />
            )}
          </div>
        </div>
      </div>

      {/* Full width: ActionPlanTimeline */}
      <div
        className={cn(
          'transition-all duration-500',
          showSection('actionPlan')
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
        )}
      >
        <ActionPlanTimeline
          phases={actionPhases}
          loading={loading && actionPhases.length === 0}
        />
      </div>

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
