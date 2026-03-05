/**
 * Product Strategy Engine - Layered analysis architecture
 *
 * Flow: Input → Signal Layer → Analysis Layer → Strategy Layer → Execution Layer
 */

/** Engine stage IDs - each maps to a real analysis layer */
export type EngineStageId =
  | 'signal_layer'      // Market Signals
  | 'trend_analysis'    // Analysis Layer: trend detection
  | 'competition_analysis'  // Analysis Layer: competition mapping
  | 'strategy_generation'   // Strategy Layer: opportunities, risks, strategy
  | 'execution_layer'   // Execution Layer: actions, features, GTM

/** Signal Layer - structured market signals */
export type SignalLayerOutput = {
  search_trends?: string[]
  news_activity?: Array<{ title: string; url?: string; publisher?: string }>
  signal_sources?: string[]
  /** Placeholder for Product Hunt, funding - populated when APIs available */
  startup_launches?: string[]
  funding_signals?: string[]
}

/** Analysis Layer - trend detection output */
export type TrendAnalysisOutput = {
  trend_summary: string
  market_temperature_score: number
  growth_signals?: string[]
}

/** Analysis Layer - competition mapping output */
export type CompetitionAnalysisOutput = {
  competitor_landscape: Array<{ name: string; positioning?: string; strength?: string; weakness?: string }>
  market_structure?: string
}

/** Strategy Layer - PM-level strategic insights */
export type StrategyLayerOutput = {
  opportunities: string[]
  risks: string[]
  strategy_summary: string
}

/** Execution Layer - actionable steps for PM */
export type ExecutionLayerOutput = {
  product_actions: Array<{ action: string; priority?: string; reasoning?: string }>
  feature_ideas: string[]
  go_to_market_steps: string[]
}

export const ENGINE_STAGE_LABELS: Record<EngineStageId, string> = {
  signal_layer: '시장 신호 수집',
  trend_analysis: '시장 성장 신호 분석',
  competition_analysis: '경쟁 환경 매핑',
  strategy_generation: '시장 리스크 평가',
  execution_layer: '제품 전략 도출',
}

export const ENGINE_UI_FLOW: EngineStageId[] = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'strategy_generation',
  'execution_layer',
]
