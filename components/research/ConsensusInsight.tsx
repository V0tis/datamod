'use client'

import { memo, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCw, CheckCircle, TrendingUp, TrendingDown, Minus, Newspaper, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts'

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

const CARD_CLASS = 'rounded-xl border border-slate-800 bg-slate-900/50 p-4'

function TrendIcon({ trend }: { trend?: 'rising' | 'falling' | 'stable' }) {
  if (trend === 'rising') return <TrendingUp className="w-5 h-5 text-emerald-400" />
  if (trend === 'falling') return <TrendingDown className="w-5 h-5 text-rose-400" />
  return <Minus className="w-5 h-5 text-slate-400" />
}

/** 감성 점수 -100~100 표시 */
function SentimentGauge({ value }: { value: number }) {
  const clamped = Math.max(-100, Math.min(100, value))
  const isPos = clamped >= 0
  const barPct = (clamped + 100) / 200 * 100
  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-2xl font-bold tabular-nums', isPos ? 'text-emerald-400' : 'text-rose-400')}>
        {clamped}
      </span>
      <div className="w-20 h-1.5 mt-1 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', isPos ? 'bg-emerald-500' : 'bg-rose-500')}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  )
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

  if (bothFailed) {
    return (
      <div className={cn('no-print w-full mb-6 antialiased', CARD_CLASS, 'min-h-[200px]')}>
        <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">전략적 통찰 및 컨센서스</h2>
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-4 space-y-3">
          <p className="text-sm text-rose-400">분석 데이터 부족. 두 AI 모두 분석에 실패해 Consensus를 생성할 수 없습니다.</p>
          <Button type="button" variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700/50 gap-1.5" disabled={loading} onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> 다시 분석하기
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={cn('no-print w-full mb-6 antialiased', CARD_CLASS, 'min-h-[320px]')} aria-busy role="status" aria-live="polite">
        <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">전략적 통찰 및 컨센서스</h2>
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-slate-400" aria-hidden />
          <p className="text-sm text-slate-400">전략 통찰 생성 중…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={cn('no-print w-full mb-6 antialiased', CARD_CLASS, 'min-h-[180px]')}>
        <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">전략적 통찰 및 컨센서스</h2>
        <p className="text-sm text-slate-500">2사 AI 요약·감성 점수는 인사이트 탭 분석 후 표시됩니다. 재분석을 눌러 주세요.</p>
      </div>
    )
  }

  const score = data.sentiment?.score ?? 0
  const trend = data.sentiment?.trend ?? 'stable'
  const summary = data.strategicSummary?.summary ?? '—'
  const confidence = data.metadata?.confidence ?? 0
  const impactData = (data.impactAnalysis ?? []).map((i) => ({ subject: i.subject, score: i.score, reason: i.reason ?? '', fullMark: 10 }))

  return (
    <motion.div
      className="no-print w-full mb-6 space-y-4 antialiased"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* Top: Consensus 리포트 카드 */}
      <div className={cn(CARD_CLASS, 'p-5')}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#e1e3e6] tracking-tight">전략적 통찰 및 컨센서스</h2>
            <span className="text-xs text-slate-500 font-normal">Consensus 리포트</span>
            {partialData && (
              <span
                className="text-xs px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40"
                title="한쪽 AI 결과만 반영되었습니다. 재분석하면 더 나은 결과를 얻을 수 있어요."
              >
                일부 데이터로 분석됨
              </span>
            )}
          </div>
          <Button type="button" variant="outline" size="sm" className="border-slate-600 text-slate-300 hover:bg-slate-700/50 gap-1.5 shrink-0" disabled={loading} onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" /> 재분석
          </Button>
        </div>
        <div className="flex flex-wrap gap-6 items-stretch">
          <div className="flex flex-col items-center justify-center shrink-0">
            <SentimentGauge value={score} />
            <div className="flex items-center gap-1.5 mt-0.5">
              <TrendIcon trend={trend} />
              <span className="text-xs text-slate-400">{trend === 'rising' ? '상승' : trend === 'falling' ? '하락' : '보합'}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <p className="text-sm text-slate-300 leading-relaxed">{summary}</p>
          </div>
          <div className="shrink-0 w-24">
            <p className="text-xs text-slate-500 font-medium mb-1">신뢰도</p>
            <div className="h-1.5 w-full rounded-full bg-slate-700/50 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }} />
            </div>
            <p className="text-xs tabular-nums text-slate-400 mt-0.5">{confidence}%</p>
          </div>
        </div>
      </div>

      {/* Middle: Radar + 지표 근거 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cn(CARD_CLASS)}>
          <h3 className="text-sm font-semibold text-slate-200 mb-3 antialiased">비즈니스 임팩트 분석 (5대 지표)</h3>
          {impactData.length > 0 ? (
            <div className="h-[260px] w-full antialiased">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="48%" outerRadius="55%" data={impactData} margin={{ top: 20, right: 56, bottom: 20, left: 56 }}>
                  <PolarGrid stroke="#334155" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} tick={{ fill: '#64748b', fontSize: 10 }} />
                  <Radar name="영향력" dataKey="score" stroke="#10b981" fill="#10b981" fillOpacity={0.35} strokeWidth={2} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null
                      const p = payload[0].payload as { subject: string; score: number; reason?: string }
                      return (
                        <div className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium text-slate-200">{p.subject} · {p.score}</p>
                          {p.reason && <p className="text-slate-400 mt-1">{p.reason}</p>}
                        </div>
                      )
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">데이터 없음</div>
          )}
        </div>
        <div className={cn(CARD_CLASS)}>
          <h3 className="text-sm font-semibold text-slate-200 mb-3 antialiased">지표 근거 (뉴스·페인포인트·경쟁 동향)</h3>
          <div className="flex gap-2 mb-3">
            {(['news', 'competitors', 'pain'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setContextTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  contextTab === tab ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {tab === 'news' && '핵심 뉴스'}
                {tab === 'competitors' && '경쟁 동향'}
                {tab === 'pain' && '페인포인트'}
              </button>
            ))}
          </div>
          <div className="min-h-[180px] text-sm text-slate-300">
            {contextTab === 'news' && (
              <ul className="space-y-2">
                {(data.marketNews ?? []).length > 0
                  ? (data.marketNews ?? []).map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <Newspaper className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))
                  : <p className="text-slate-500">요약된 뉴스가 없습니다.</p>}
              </ul>
            )}
            {contextTab === 'competitors' && (
              <p className="leading-relaxed">{(data.competitorTrends ?? '').trim() || '경쟁사 동향 정보가 없습니다.'}</p>
            )}
            {contextTab === 'pain' && (
              <ul className="space-y-2">
                {(data.painPoints ?? []).length > 0
                  ? (data.painPoints ?? []).map((item, i) => (
                      <li key={i} className="flex gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400/80 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))
                  : <p className="text-slate-500">페인포인트가 없습니다.</p>}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Bottom: SWOT + 우선순위 실행 과제 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cn(CARD_CLASS, 'border-emerald-500/30 bg-emerald-900/20')}>
          <h3 className="text-sm font-semibold text-emerald-400 mb-2 antialiased">Opportunity</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{(data.strategicSummary?.opportunity ?? '—').trim() || '—'}</p>
        </div>
        <div className={cn(CARD_CLASS, 'border-rose-500/30 bg-rose-900/20')}>
          <h3 className="text-sm font-semibold text-rose-400 mb-2">Threat</h3>
          <p className="text-sm text-slate-300 leading-relaxed">{(data.strategicSummary?.threat ?? '—').trim() || '—'}</p>
        </div>
      </div>
      <div className={cn(CARD_CLASS)}>
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2 antialiased">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          우선순위 실행 과제 (Action Items)
        </h3>
        <ul className="space-y-2">
          {(data.strategicSummary?.actionItems ?? []).length > 0
            ? (data.strategicSummary.actionItems ?? []).map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-200">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden />
                  <span>{item}</span>
                </li>
              ))
            : <p className="text-slate-500 text-sm">과제가 없습니다.</p>}
        </ul>
      </div>
    </motion.div>
  )
}

export const ConsensusInsight = memo(ConsensusInsightComponent)
