/**
 * Default values for research UI during analysis loading.
 * 분석 중에도 차트·기회점수 등 UI가 default 상태로 표시되도록 사용.
 */
import type { ChartData, ResearchResponse } from '@/lib/stores/research-store'

export const DEFAULT_CHART_DATA: ChartData = {
  sentiment: { positive: 65, neutral: 20, negative: 15 },
  impact: [
    { subject: '경제', score: 5 },
    { subject: '사회', score: 5 },
    { subject: '기술', score: 5 },
    { subject: '정치', score: 5 },
    { subject: '환경', score: 5 },
  ],
}

/** 기회 점수 분해 default (분석 중 표시용, 중립 50 = base만). 경쟁압력 0. */
export const DEFAULT_OPPORTUNITY_BREAKDOWN = {
  market_growth: 0,
  trend_momentum: 0,
  competition_density: 0,
  competition_pressure: 0,
  funding_signals: 0,
  risk_factors: 0,
} as const

/** 분석 중 key_metrics가 없을 때 사용할 default (차트·기회점수 UI용) */
export const DEFAULT_KEY_METRICS_LOADING: NonNullable<ResearchResponse['key_metrics']> = {
  opportunity_score: 50,
  opportunity_score_breakdown: { ...DEFAULT_OPPORTUNITY_BREAKDOWN },
  chartData: DEFAULT_CHART_DATA,
  sentiment: 50,
  confidence_score: 75,
  positive_signals: [],
  neutral_signals: [],
  negative_risks: [],
  summary_insights: '분석 중입니다.',
  keyConclusions: [],
  opportunity_score_reasoning: '',
}
