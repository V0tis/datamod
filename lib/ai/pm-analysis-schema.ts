/**
 * Canonical PM analysis output schema.
 * All AI analysis responses must conform to this structure.
 * Used by initial research, consensus synthesis, and parsing.
 */
export type AnalysisTarget = 'product' | 'company' | 'market' | 'person' | 'policy' | 'technology'
export type AnalysisScope = 'market' | 'sentiment' | 'momentum' | 'risk' | 'opportunity'
export type TrendValue = 'rising' | 'stable' | 'declining'
export type AnalysisQuality = 'low' | 'medium' | 'high'

export interface PMAnalysisMeta {
  analysis_target: AnalysisTarget
  analysis_scope: AnalysisScope
  confidence_score: number
  analysis_quality: AnalysisQuality
  generated_at: string
}

export interface MarketTemperatureExplanation {
  positive_signals: string[]
  neutral_signals: string[]
  negative_risks: string[]
}

export interface MarketTemperature {
  score: number
  trend: TrendValue
  explanation: MarketTemperatureExplanation
}

export interface PMAnalysisInsights {
  facts: string[]
  hypotheses: string[]
  inferences: string[]
}

export type UrgencyLevel = 'low' | 'medium' | 'high'

export interface RecommendedAction {
  title: string
  reasoning: string
  urgency_level: UrgencyLevel
  related_risk?: string
}

/** recommended_actions: structured (title, reasoning, urgency_level) or legacy string[]. */
export interface PMActions {
  recommended_actions: (RecommendedAction | string)[]
  monitoring_points: string[]
  decision_risks: string[]
}

export interface PMAnalysisOutput {
  meta: PMAnalysisMeta
  market_temperature: MarketTemperature
  insights: PMAnalysisInsights
  pm_actions: PMActions
}

/** JSON schema string for prompts (strict output format). */
export const PM_ANALYSIS_JSON_SCHEMA = `{
  "meta": {
    "analysis_target": "product" | "company" | "market" | "person" | "policy" | "technology",
    "analysis_scope": "market" | "sentiment" | "momentum" | "risk" | "opportunity",
    "confidence_score": number (0-100),
    "analysis_quality": "low" | "medium" | "high",
    "generated_at": ISO 8601 timestamp
  },
  "market_temperature": {
    "score": number (0-100),
    "trend": "rising" | "stable" | "declining",
    "explanation": {
      "positive_signals": string[],
      "neutral_signals": string[],
      "negative_risks": string[]
    }
  },
  "insights": {
    "facts": string[],
    "hypotheses": string[],
    "inferences": string[]
  },
  "pm_actions": {
    "recommended_actions": [{ "title": string, "reasoning": string, "urgency_level": "low"|"medium"|"high", "related_risk"?: string }],
    "monitoring_points": string[],
    "decision_risks": string[]
  }
}`
