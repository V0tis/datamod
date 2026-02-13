'use client'

import { Button } from '@/components/ui/button'
import { SentimentGauge } from '@/components/research/SentimentGauge'
import { Loader2, RefreshCw } from 'lucide-react'

export interface ConsensusData {
  summary: string
  sentiment: number
  strategic_insight: string
  action_item: string
  confidence: number
}

export interface ConsensusInsightProps {
  /** DB 또는 API에서 온 유효한 consensus 데이터. 있으면 즉시 렌더링 */
  data: ConsensusData | null
  /** Consensus API 호출 중 (Groq·Gemini는 이미 settled) */
  loading: boolean
  /** 두 AI 모두 실패한 경우 Consensus 호출 없이 에러만 표시 */
  bothFailed: boolean
  /** 한쪽이라도 실패 시 표시할 메시지 (bothFailed가 아닐 때) */
  errorMessage: string | null
  /** 결과 없음 안내 문구 */
  noResultMessage?: string
  onRetry: () => void
}

export function ConsensusInsight({
  data,
  loading,
  bothFailed,
  errorMessage,
  noResultMessage = '2사 AI 요약·감성 점수는 인사이트 탭 분석 후 표시됩니다. 위에서 "재분석 (캐시 무시)"를 누르면 다시 계산됩니다.',
  onRetry,
}: ConsensusInsightProps) {
  if (bothFailed) {
    return (
      <div className="no-print w-full mb-6 rounded-xl border border-zinc-800 bg-[#15171a] p-5">
        <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">AI Insight Consensus</h2>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
          <p className="text-sm text-rose-400">두 AI 모두 분석에 실패했습니다. Consensus를 생성할 수 없습니다.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-600 text-slate-300 hover:bg-zinc-700/50 gap-1.5"
            disabled={loading}
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            다시 분석하기
          </Button>
        </div>
      </div>
    )
  }

  if (data) {
    return (
      <div className="no-print w-full mb-6 rounded-xl border border-zinc-800 bg-[#15171a] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-[#e1e3e6] tracking-tight">AI Insight Consensus</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-600 text-slate-300 hover:bg-zinc-700/50 gap-1.5 shrink-0"
            disabled={loading}
            onClick={onRetry}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {loading ? '재분석 중...' : '재분석'}
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="flex justify-center md:justify-start">
            <SentimentGauge value={data.sentiment} />
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <p className="text-sm text-slate-300 leading-relaxed">{data.summary}</p>
            {data.strategic_insight && data.strategic_insight !== '—' && (
              <div>
                <span className="text-xs text-slate-500 font-medium">핵심 전략</span>
                <p className="text-sm text-slate-200 mt-0.5">{data.strategic_insight}</p>
              </div>
            )}
            {data.action_item && data.action_item !== '—' && (
              <div>
                <span className="text-xs text-slate-500 font-medium">실행 권고</span>
                <p className="text-sm text-slate-200 mt-0.5">{data.action_item}</p>
              </div>
            )}
            {typeof data.confidence === 'number' && (
              <p className="text-xs text-slate-500">
                신뢰도 <span className="tabular-nums text-slate-400">{data.confidence}%</span>
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="no-print w-full mb-6 rounded-xl border border-zinc-800 bg-[#15171a] p-5">
        <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">AI Insight Consensus</h2>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="w-[140px] h-[70px] rounded-t-full border border-zinc-700 border-b-0 bg-zinc-800/30 animate-pulse" />
            <div className="h-5 w-12 bg-zinc-700/50 rounded animate-pulse" />
            <div className="h-3 w-14 bg-zinc-700/50 rounded animate-pulse" />
          </div>
          <div className="flex flex-col gap-3 min-w-0">
            <div className="space-y-2">
              <div className="h-3 w-full max-w-md bg-zinc-700/50 rounded animate-pulse" />
              <div className="h-3 w-full max-w-sm bg-zinc-700/50 rounded animate-pulse" />
              <div className="h-3 w-4/5 max-w-xs bg-zinc-700/50 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="no-print w-full mb-6 rounded-xl border border-zinc-800 bg-[#15171a] p-5">
        <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">AI Insight Consensus</h2>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
          <p className="text-sm text-rose-400">{errorMessage}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-zinc-600 text-slate-300 hover:bg-zinc-700/50 gap-1.5"
            disabled={loading}
            onClick={onRetry}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            다시 분석하기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="no-print w-full mb-6 rounded-xl border border-zinc-800 bg-[#15171a] p-5">
      <h2 className="text-sm font-semibold text-[#e1e3e6] mb-4 tracking-tight">AI Insight Consensus</h2>
      <p className="text-sm text-slate-500">{noResultMessage}</p>
    </div>
  )
}
