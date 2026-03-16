/**
 * Multi-step AI Analysis Pipeline - Structured JSON output per step
 *
 * Steps:
 * 1. Market Research
 * 2. Competitor Analysis
 * 3. Insight Extraction
 * 4. Strategic Recommendation
 * 5. PM Action Plan
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX } from './base-prompt'

export const PIPELINE_BASE_SYSTEM = `${BASE_JSON_PROMPT}

You are a strategic market analyst for Product Managers.`

/** Step 3: Insight Extraction - structured core insights + legacy arrays for strategy step */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
You must return TWO structures:

1. "core_insights": array of 3-5 PM-ready insights. Each item MUST have:
   - "title": short phrase (5-15 chars, e.g. "시장 성장성", "경쟁 강도"). Do NOT copy summary.
   - "summary": 1-2 sentences describing the insight. Must be DIFFERENT from title.
   - "impact": business impact (e.g. "매출·점유율에 직접 영향", "진입 타이밍 결정"). Do NOT leave empty.
   - "reason": why this matters for PM / product (e.g. "우선순위 결정 근거"). Do NOT leave empty.
   - "score": optional number 1-10.

Rules: Do NOT repeat the same text in title and summary. Do NOT leave impact or reason empty. Do NOT duplicate insights. Each field must be unique, non-empty Korean text.

2. Legacy arrays (for downstream steps):
   "key_insights": ["인사이트1", ...],
   "opportunity_signals": ["기회1", ...],
   "risk_signals": ["리스크1", ...]

Format: {
  "core_insights": [
    { "title": "짧은 제목", "summary": "요약 문장", "impact": "비즈니스 영향", "reason": "PM 관점 이유" }
  ],
  "key_insights": ["문자열"],
  "opportunity_signals": ["문자열"],
  "risk_signals": ["문자열"]
}
Return ONLY valid JSON. All strings in Korean.`

export function buildInsightExtractionPrompt(
  keyword: string,
  marketOverview: string,
  competitionSummary: string
): string {
  return `Keyword: ${keyword}

Market Overview: ${marketOverview}

Competition: ${competitionSummary}

Extract 3-5 core_insights (each with title, summary, impact, reason - all different, no empty). Also return key_insights, opportunity_signals, risk_signals arrays. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Step 4: Strategic Recommendation - opportunities, risks, strategy summary */
export const STRATEGIC_RECOMMENDATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Format: {
  "opportunities": ["기회1", "기회2", "기회3"],
  "risks": ["리스크1", "리스크2", "리스크3"],
  "strategy_summary": "2-3문장 제품 전략 요약",
  "market_summary": "1-2문장 시장 요약",
  "key_strategic_insights": ["전략 인사이트1", "전략 인사이트2", "전략 인사이트3"]
}`

export function buildStrategicRecommendationPrompt(
  keyword: string,
  marketOverview: string,
  competitionSummary: string,
  extractedInsights: { key_insights?: string[]; opportunity_signals?: string[]; risk_signals?: string[] }
): string {
  const insights = [
    ...(extractedInsights.key_insights ?? []),
    ...(extractedInsights.opportunity_signals ?? []),
    ...(extractedInsights.risk_signals ?? []),
  ].filter(Boolean)
  const insightsBlock = insights.length ? `\nExtracted insights:\n${insights.map((i) => `- ${i}`).join('\n')}` : ''
  return `Keyword: ${keyword}

Market Overview: ${marketOverview}

Competition: ${competitionSummary}${insightsBlock}

Produce strategic recommendations. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Step 5: PM Action Plan - actionable product/GTM plan */
export const PM_ACTION_PLAN_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Format: {
  "product_idea": "구체적 제품 컨셉",
  "target_customer": "타겟 고객 세그먼트",
  "monetization": "수익화 모델",
  "product_actions": [{
    "action": "액션명",
    "priority": "high|medium|low",
    "reasoning": "근거"
  }],
  "feature_ideas": ["아이디어1", "아이디어2", "아이디어3"],
  "go_to_market_steps": ["GTM 단계1", "GTM 단계2", "GTM 단계3"],
  "pm_action_plan": [{
    "action_title": "액션 제목",
    "description": "구체적 실행 방법",
    "expected_outcome": "기대 결과",
    "priority": "high|medium|low",
    "category": "mvp_experiment|user_interview|feature_prioritization|go_to_market"
  }],
  "next_actions_pm": [{
    "action": "액션명",
    "why": "이유",
    "how_to_execute": "실행 방법",
    "priority": "high|medium|low"
  }],
  "strategic_decision_layer": {
    "market_opportunity_explanation": "시장 기회도 점수 이유 (한 줄, why_score)",
    "competition_intensity": "low|medium|high",
    "competition_explanation": "경쟁 강도 이유 (한 줄, reason)",
    "product_market_fit": "low|medium|high",
    "product_market_fit_explanation": "제품-시장 적합성 이유 (한 줄, reason)",
    "entry_strategy": "진입 전략 요약",
    "entry_explanation": "진입 전략 근거 (한 줄, reason)"
  },
  "swot_analysis": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
  "jtbd": { "main_jobs": [], "pains": [], "gains": [] }
}
Include 2-4 product_actions, 4-8 pm_action_plan items, 3-5 next_actions_pm. For strategic_decision_layer, always provide each explanation (reason/why_score) in one short sentence.`

export function buildPMActionPlanPrompt(
  keyword: string,
  strategySummary: string,
  opportunitiesSummary: string,
  risksSummary: string
): string {
  return `Keyword: ${keyword}

Strategy: ${strategySummary}

Opportunities: ${opportunitiesSummary}

Risks: ${risksSummary}

Generate actionable PM plan. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Strategy Evaluation - score each dimension 1-10 + label and reason per dimension */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Evaluate the generated strategy. Return score, label, and reason for EACH dimension.

Format: {
  "market_attractiveness": number (1=low, 10=high),
  "market_attractiveness_label": "한 단어 라벨 (예: 높음/보통/낮음)",
  "market_attractiveness_reason": "이 점수 이유 한 줄",
  "competition_risk": number (1=low risk, 10=high risk),
  "competition_risk_label": "한 단어 라벨",
  "competition_risk_reason": "이 점수 이유 한 줄",
  "execution_difficulty": number (1=easy, 10=very hard),
  "execution_difficulty_label": "한 단어 라벨",
  "execution_difficulty_reason": "이 점수 이유 한 줄",
  "growth_potential": number (1=low, 10=high),
  "growth_potential_label": "한 단어 라벨",
  "growth_potential_reason": "이 점수 이유 한 줄"
}
All scores must be integers 1-10. All _label and _reason fields must be short Korean.`

export function buildStrategyEvaluationPrompt(
  keyword: string,
  strategySummary: string,
  opportunitiesSummary: string,
  risksSummary: string,
  competitionSummary: string,
  productActions: string[]
): string {
  const actionsBlock = productActions.length ? `Product actions:\n${productActions.slice(0, 5).map((a, i) => `${i + 1}. ${a}`).join('\n')}` : ''
  return `Keyword: ${keyword}

Strategy: ${strategySummary}

Opportunities: ${opportunitiesSummary}

Risks: ${risksSummary}

Competition: ${competitionSummary}
${actionsBlock ? `\n${actionsBlock}` : ''}

Evaluate this strategy. For each dimension return score, label, and reason. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}
