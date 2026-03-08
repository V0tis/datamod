/**
 * PM Keyword Opportunity Analysis output schema.
 * Structured for startup product decision-making.
 */

export interface KeywordContext {
  summary: string
  user_scenarios: string[]
}

export type MarketSignalType = 'cultural' | 'technology' | 'product' | 'news'

export interface MarketSignal {
  signal: string
  evidence: string
  type: MarketSignalType
}

export interface UserIntent {
  intent: string
  description: string
}

export interface CompetitorEntry {
  company: string
  product: string
  positioning: string
  strength: string
  weakness: string
}

export interface ProductOpportunity {
  opportunity: string
  target_user: string
  problem: string
  why_now: string
}

export interface ProductIdea {
  idea: string
  target_user: string
  core_feature: string
  differentiation: string
}

export type TrendType = 'short_term' | 'mid_term' | 'long_term'

export interface TrendAssessment {
  trend_type: TrendType
  risk_factors: string[]
}

export interface PMOpportunityOutput {
  keyword_context: KeywordContext
  market_signals: MarketSignal[]
  user_intent: UserIntent[]
  competitive_landscape: CompetitorEntry[]
  product_opportunities: ProductOpportunity[]
  product_ideas: ProductIdea[]
  trend_assessment: TrendAssessment
  pm_validation_questions: string[]
}

export const PM_OPPORTUNITY_JSON_SCHEMA = `{
  "keyword_context": {
    "summary": "string",
    "user_scenarios": ["string"]
  },
  "market_signals": [
    {
      "signal": "string",
      "evidence": "string",
      "type": "cultural | technology | product | news"
    }
  ],
  "user_intent": [
    {
      "intent": "string",
      "description": "string"
    }
  ],
  "competitive_landscape": [
    {
      "company": "string",
      "product": "string",
      "positioning": "string",
      "strength": "string",
      "weakness": "string"
    }
  ],
  "product_opportunities": [
    {
      "opportunity": "string",
      "target_user": "string",
      "problem": "string",
      "why_now": "string"
    }
  ],
  "product_ideas": [
    {
      "idea": "string",
      "target_user": "string",
      "core_feature": "string",
      "differentiation": "string"
    }
  ],
  "trend_assessment": {
    "trend_type": "short_term | mid_term | long_term",
    "risk_factors": ["string"]
  },
  "pm_validation_questions": ["string"]
}`
