'use client'

import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { Loader2, RefreshCw, CheckCircle, TrendingUp, TrendingDown, Minus, Newspaper, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConfidenceDisplay } from '@/lib/confidence-display'
import { ConfidenceIndicator } from '@/components/research/confidence-indicator'
import { CognitiveLayerLabel } from '@/components/research/cognitive-layer-label'
import { InsightCard } from '@/components/research/InsightCard'
import { SentimentFactorBreakdown } from '@/components/research/sentiment-factor-breakdown'

/** API/DB 신형 Consensus (PM 프레임워크) */
export interface ConsensusImpactItem {
  subject: string
  score: number
  reason?: string
}
export interface ConsensusSentiment {
  score: number
  trend?: 'rising' | 'falling' | 'stable'
  ratio?: { positive?: number; neutral?: number; negative?: number }
}
export interface ConsensusStrategicSummary {
  summary: string
  opportunity?: string
  threat?: string
  actionItems?: string[]
}
export interface ConsensusMetadata {
  confidence: number
  dataPeriod?: string
}

export interface ConsensusData {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment: ConsensusSentiment
  impactAnalysis?: ConsensusImpactItem[]
  strategicSummary: ConsensusStrategicSummary
  metadata: ConsensusMetadata
}

/** 구형 flat 응답 → ConsensusData (하위 호환) */
export function normalizeConsensusData(raw: unknown): ConsensusData | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.strategicSummary && typeof o.strategicSummary === 'object' && typeof (o.strategicSummary as Record<string, unknown>).summary === 'string') {
    const ss = o.strategicSummary as Record<string, unknown>
    const sent = o.sentiment as Record<string, unknown> | undefined
    const score = typeof sent?.score === 'number' ? Math.max(-100, Math.min(100, sent.score as number)) : 0
    const meta = o.metadata as Record<string, unknown> | undefined
    const confidence = typeof meta?.confidence === 'number' ? Math.max(0, Math.min(100, meta.confidence as number)) : 0
    const impact = Array.isArray(o.impactAnalysis)
      ? (o.impactAnalysis as ConsensusImpactItem[]).slice(0, 5)
      : []
    return {
      marketNews: Array.isArray(o.marketNews) ? (o.marketNews as string[]) : [],
      painPoints: Array.isArray(o.painPoints) ? (o.painPoints as string[]) : [],
      competitorTrends: typeof o.competitorTrends === 'string' ? o.competitorTrends : '',
      sentiment: {
        score,
        trend: sent?.trend === 'rising' || sent?.trend === 'falling' || sent?.trend === 'stable' ? sent.trend : 'stable',
        ratio: sent?.ratio as ConsensusSentiment['ratio'],
      },
      impactAnalysis: impact,
      strategicSummary: {
        summary: typeof ss.summary === 'string' ? ss.summary : '—',
        opportunity: typeof ss.opportunity === 'string' ? ss.opportunity : '—',
        threat: typeof ss.threat === 'string' ? ss.threat : '—',
        actionItems: Array.isArray(ss.actionItems) ? (ss.actionItems as string[]) : [],
      },
      metadata: { confidence, dataPeriod: typeof meta?.dataPeriod === 'string' ? meta.dataPeriod : '최근 24시간' },
    }
  }
  if (typeof o.summary === 'string' || typeof o.sentiment === 'number') {
    const summary = typeof o.summary === 'string' ? o.summary : '—'
    const score = typeof o.sentiment === 'number' ? Math.max(-100, Math.min(100, o.sentiment)) : 0
    const confidence = typeof o.confidence === 'number' ? Math.max(0, Math.min(100, o.confidence)) : 0
    const actionItems = Array.isArray(o.action_item)
      ? (o.action_item as string[])
      : typeof o.action_item === 'string' && o.action_item !== '—'
        ? [o.action_item]
        : []
    return {
      marketNews: [],
      painPoints: [],
      competitorTrends: '',
      sentiment: { score, trend: 'stable' },
      impactAnalysis: [
        { subject: '시장성', score: 5, reason: '—' },
        { subject: '기술성', score: 5, reason: '—' },
        { subject: '반응성', score: 5, reason: '—' },
        { subject: '규제/환경', score: 5, reason: '—' },
        { subject: '경쟁력', score: 5, reason: '—' },
      ],
      strategicSummary: {
        summary,
        opportunity: typeof o.strategic_insight === 'string' ? o.strategic_insight : '—',
        threat: '—',
        actionItems,
      },
      metadata: { confidence, dataPeriod: '최근 24시간' },
    }
  }
  return null
}

export interface ConsensusInsightProps {
  data: ConsensusData | null
  loading: boolean
  bothFailed: boolean
  partialData?: boolean
  errorMessage: string | null
  onRetry: () => void
}

const CARD_CLASS = 'rounded-xl border border-border bg-muted/30 p-4'

function TrendIcon({ trend }: { trend?: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <TrendingUp className="w-5 h-5 text-emerald-400" />
  if (trend === 'falling') return <TrendingDown className="w-5 h-5 text-rose-400" />
  return <Minus className="w-5 h-5 text-muted-foreground" />
}

/** Sentiment as concise text (report-style); no gauge/chart. */
function SentimentText({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value))
  return <span className="text-sm font-semibold tabular-nums text-foreground">{clamped}</span>
}

function ConsensusInsightComponent({
  data,
  loading,
  bothFailed,
  partialData = false,
  errorMessage,
  onRetry,
}: ConsensusInsightProps) {
  const [contextTab, setContextTab] = useState<'news' | 'competitors' | 'pain'>('news')
  const [signalOpen, setSignalOpen] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const summaryLong = (data?.strategicSummary?.summary?.length ?? 0) > 200

  if (bothFailed) {
    return (
      <div className={cn('no-print w-full mb-6 antialiased', CARD_CLASS, 'min-h-[200px]')} role="alert" aria-live="assertive">
        <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">전략적 통찰 및 컨센서스</h2>
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm text-destructive">두 엔진 모두 분석에 실패했습니다. 전략 통찰을 만들 수 없습니다. 아래 버튼으로 다시 시도해 주세요.</p>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={onRetry} aria-label="전략 통찰 다시 분석">
            <RefreshCw className="h-3.5 w-3.5" /> 다시 분석하기
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn('no-print w-full mb-6 antialiased', CARD_CLASS, 'min-h-[320px]')}>
        <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">전략적 통찰 및 컨센서스</h2>
        <LoadingState
          message="두 엔진 결과를 종합해 전략 통찰을 만드는 중입니다"
          detail="잠시만 기다려 주세요."
          size="md"
          icon={<Loader2 className="w-8 h-8 animate-spin text-muted-foreground" aria-hidden />}
          className="py-12"
        />
      </div>
    )
  }

  if (!data) {
    return (
      <div className={cn('no-print w-full mb-6 antialiased', CARD_CLASS)}>
        <h2 className="text-sm font-semibold text-foreground mb-4 tracking-tight">전략적 통찰 및 컨센서스</h2>
        <EmptyState
          title="아직 전략 통찰이 없어요"
          description="인사이트 탭 분석이 끝나면 여기에 요약과 감성 점수가 표시돼요. 아래 버튼으로 재분석해 주세요."
          className="py-6"
          action={
            <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={loading} onClick={onRetry} aria-label="전략 통찰 재분석">
              <RefreshCw className="h-3.5 w-3.5" /> 재분석
            </Button>
          }
        />
      </div>
    )
  }

  const score = data.sentiment?.score ?? 0
  const trend = data.sentiment?.trend ?? 'stable'
  const summary = data.strategicSummary?.summary ?? '—'
  const confidenceValue = data.metadata?.confidence ?? 0
  const actionItems = data.strategicSummary?.actionItems ?? []
  const impactData = (data.impactAnalysis ?? []).map((i) => ({ subject: i.subject, score: i.score, reason: i.reason ?? '', fullMark: 10 }))
  const painPoints = data.painPoints ?? []
  const marketNews = data.marketNews ?? []
  const competitorTrends = (data.competitorTrends ?? '').trim()
  const opportunity = (data.strategicSummary?.opportunity ?? '—').trim() || '—'
  const threat = (data.strategicSummary?.threat ?? '—').trim() || '—'
  const confidenceDisplay = getConfidenceDisplay(confidenceValue, {
    partialData: partialData ?? false,
    hasSummary: Boolean(summary?.trim()),
    actionItemsCount: actionItems.length,
  })

  return (
    <motion.div
      className="no-print w-full mb-6 space-y-6 antialiased"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* So what? — AI conclusion (hypothesis layer). Summary first for scanning. */}
      <div className={cn(CARD_CLASS, 'p-4 sm:p-5 border-primary/30')}>
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
          <span className="inline-flex flex-wrap items-center gap-2">
            <CognitiveLayerLabel layer="hypothesis" />
            <span className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary">
              So what? — 통찰
            </span>
          </span>
          {partialData && (
            <span
              className="text-xs px-2 py-0.5 rounded-md bg-warning/20 text-warning border border-warning/40"
              title="한쪽 AI 결과만 반영되었습니다. 재분석하면 더 나은 결과를 얻을 수 있습니다."
            >
              일부 데이터로 분석됨
            </span>
          )}
          <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={loading} onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> 재분석
          </Button>
        </div>
        <p
          className={cn(
            'text-base sm:text-lg text-foreground leading-snug font-semibold break-words tracking-tight',
            summaryLong && !summaryExpanded ? 'mb-2 line-clamp-4' : 'mb-4 sm:mb-5'
          )}
        >
          {summary}
        </p>
        {summaryLong && !summaryExpanded && (
          <button
            type="button"
            onClick={() => setSummaryExpanded(true)}
            className="mb-4 sm:mb-5 flex items-center gap-1 text-xs font-medium text-emerald-400 hover:underline"
          >
            전체 보기
          </button>
        )}
        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-6 items-stretch sm:items-center border-t border-border pt-4 sm:pt-5">
          <div className="flex items-center gap-2 shrink-0">
            <SentimentText value={score} />
            <span className="text-muted-foreground">·</span>
            <TrendIcon trend={trend} />
            <span className="text-xs text-muted-foreground">{trend === 'rising' ? '상승' : trend === 'falling' ? '하락' : '보합'}</span>
          </div>
          {confidenceDisplay != null && (
            <div className="shrink-0 w-full sm:min-w-[140px] sm:max-w-[200px]">
              <ConfidenceIndicator display={confidenceDisplay} />
            </div>
          )}
        </div>
        {/* Evaluation rationale: why this score + interpretation guidance. */}
        {data.sentiment?.ratio && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-[11px] font-medium text-muted-foreground mb-2">Why this score?</p>
            <SentimentFactorBreakdown factors={data.sentiment.ratio} />
          </div>
        )}
        {!data.sentiment?.ratio && (
          <p className="text-[11px] text-muted-foreground mt-4 pt-4 border-t border-border/50">
            이 점수는 뉴스·시장 신호와 두 AI 통찰을 종합해 -100~100으로 산출했습니다.
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          What this means for decision-making: 양수는 긍정적 시장 신호가 강함을, 음수는 리스크·부정 요인이 반영되었음을 나타냅니다. 전략 수립 시 참고 지표로 활용하세요.
        </p>
      </div>

      {/* Why? — Evidence (fact layer): problem & signal. */}
      <CognitiveLayerLabel layer="fact" className="block pt-2 pb-0.5" />
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground pt-0.5 pb-1" aria-hidden>Why? — 근거·맥락</p>
      <InsightCard label="Problem" title="페인포인트·리스크">
        {painPoints.length > 0 ? (
          <ul className="space-y-2 list-none pl-0">
            {painPoints.map((item, i) => (
              <li key={i} className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">페인포인트가 없습니다.</p>
        )}
        {threat !== '—' && (
          <>
            <p className="text-xs font-semibold text-rose-400 mt-4 mb-1">Threat</p>
            <p className="leading-relaxed">{threat}</p>
          </>
        )}
      </InsightCard>

      {/* Signal — market news, competitor trends. Collapsible on small screens (secondary detail). */}
      <div className="space-y-3 sm:space-y-4">
        <div className="rounded-xl border border-border bg-muted/30 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 min-h-[44px] p-3 sm:p-4 text-left hover:bg-muted-hover transition-colors sm:pointer-events-none sm:hover:bg-transparent touch-manipulation"
            onClick={() => setSignalOpen((o) => !o)}
            aria-expanded={signalOpen}
            aria-controls="consensus-signal-content"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider', 'text-amber-600 dark:text-amber-400 border-amber-500/40 bg-amber-500/10')}>
                Signal
              </span>
              <span className="text-sm font-semibold text-foreground truncate">시장·경쟁 신호</span>
            </div>
            <span className="sm:hidden shrink-0 text-muted-foreground">{signalOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
          </button>
          <div id="consensus-signal-content" className={cn('border-t border-border', signalOpen ? 'block' : 'hidden', 'sm:block')} aria-hidden={!signalOpen}>
            <div className="p-3 sm:p-4">
              <div className="flex gap-2 mb-3">
                {(['news', 'competitors'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setContextTab(tab)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      contextTab === tab ? 'bg-muted-hover text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab === 'news' ? '핵심 뉴스' : '경쟁 동향'}
                  </button>
                ))}
              </div>
              {contextTab === 'competitors' ? (
                <p className="leading-relaxed break-words text-sm text-foreground">{competitorTrends || '경쟁사 동향 정보가 없습니다.'}</p>
              ) : marketNews.length > 0 ? (
                <ul className="space-y-2 list-none pl-0">
                  {marketNews.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <Newspaper className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="break-words text-sm text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground text-sm">요약된 뉴스가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
        {/* Impact: list with interpretation so PMs know how to use the scores. */}
        <div className={cn(CARD_CLASS)}>
          <h4 className="text-xs font-medium text-muted-foreground mb-1">비즈니스 임팩트</h4>
          <p className="text-[11px] text-muted-foreground mb-2">How to read: 각 지표 0–10. 높을수록 해당 요인이 시장에 긍정적으로 작용한다고 해석됩니다. 우선순위·리소스 배분 참고용입니다.</p>
          {impactData.length > 0 ? (
            <ul className="space-y-1.5 list-none pl-0 text-sm text-foreground">
              {impactData.map((item, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{item.subject}</span>
                  <span className="tabular-nums text-muted-foreground">{item.score}/10</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">데이터 없음</p>
          )}
        </div>
      </div>

      {/* So what? — Implications (assumption layer): recommendations + interpretation. */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 sm:p-5">
        <CognitiveLayerLabel layer="assumption" className="block mb-1.5" />
        <div className="inline-flex items-center rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
          다음 액션 — 의사결정 참고
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">AI가 통찰을 바탕으로 제안한 과제입니다. 우선순위와 실행 여부는 팀 판단으로 결정하세요.</p>
        {opportunity !== '—' && (
          <>
            <p className="text-xs font-semibold text-primary mb-1">Opportunity</p>
            <p className="text-sm leading-relaxed mb-4 text-foreground">{opportunity}</p>
          </>
        )}
        {actionItems.length > 0 ? (
          <ul className="space-y-2.5 list-none pl-0">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
                <span className="text-sm font-medium text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">과제가 없습니다.</p>
        )}
      </div>
    </motion.div>
  )
}

export const ConsensusInsight = memo(ConsensusInsightComponent)
