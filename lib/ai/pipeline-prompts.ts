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

export const PIPELINE_BASE_SYSTEM = `You are a strategic market analyst for Product Managers.
CRITICAL: Output ONLY valid JSON. No markdown, no commentary, no extra text.
All content must be in Korean (한국어). Do NOT use Chinese (中文).`

/** Step 1: Market Research - structured JSON */
export const MARKET_RESEARCH_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Format: {
  "market_overview": "2-3문장 시장 개요 (동향, 규모, 성장성)",
  "market_temperature": number (0-100, 시장 열기/관심도),
  "growth_signals": ["신호1", "신호2", "신호3"],
  "news_synthesis": "뉴스 기반 핵심 요약 (1-2문장)"
}`

export function buildMarketResearchPrompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length
    ? `News headlines:\n${newsTitles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
    : ''
  return `${block}Keyword: ${keyword}
Analyze market trends and growth signals from the news. Return ONLY the JSON object. All text in Korean.`
}

/** Step 2: Competitor Analysis - already in pm-strategic-prompt, re-export schema */
export const COMPETITOR_ANALYSIS_JSON_SCHEMA = `{
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝",
    "target_market": "타겟 시장",
    "key_feature": "핵심 기능",
    "strength": "강점",
    "weakness": "약점"
  }],
  "market_structure": { "summary": "시장 구조 요약" }
}`

/** Step 3: Insight Extraction - key insights from market + competitor */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Format: {
  "key_insights": ["인사이트1", "인사이트2", "인사이트3", "인사이트4", "인사이트5"],
  "opportunity_signals": ["기회 신호1", "기회 신호2", "기회 신호3"],
  "risk_signals": ["리스크1", "리스크2", "리스크3"]
}
Extract 3-5 key insights, 2-4 opportunity signals, 2-4 risk signals. Be specific and actionable.`

export function buildInsightExtractionPrompt(
  keyword: string,
  marketOverview: string,
  competitionSummary: string
): string {
  return `Keyword: ${keyword}

Market Overview: ${marketOverview}

Competition: ${competitionSummary}

Extract key insights, opportunity signals, and risk signals. Return ONLY the JSON object. All text in Korean.`
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

Produce strategic recommendations. Return ONLY the JSON object. All text in Korean.`
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
    "market_opportunity_explanation": "시장 기회 근거",
    "competition_intensity": "low|medium|high",
    "product_market_fit": "low|medium|high",
    "entry_strategy": "진입 전략"
  },
  "swot_analysis": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
  "jtbd": { "main_jobs": [], "pains": [], "gains": [] }
}
Include 2-4 product_actions, 4-8 pm_action_plan items, 3-5 next_actions_pm. All in Korean.`

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

Generate actionable PM plan. Return ONLY the JSON object. All text in Korean.`
}

/** Strategy Evaluation - score each dimension 1-10 */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Evaluate the generated strategy and score each dimension from 1 to 10.

Format: {
  "market_attractiveness": number (1=low, 10=high – how attractive is the market?),
  "competition_risk": number (1=low risk, 10=high risk – how intense is competition?),
  "execution_difficulty": number (1=easy, 10=very hard – how difficult to execute?),
  "growth_potential": number (1=low, 10=high – growth opportunity)
}
All scores must be integers 1-10.`

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

Evaluate this strategy. Score each dimension 1-10. Return ONLY the JSON object.`
}
