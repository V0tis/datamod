/**
 * PM Strategic Analysis Prompt
 * Single unified JSON output for decision-making.
 * Avoid fluff, marketing, exaggerated confidence.
 */

export const STRATEGIC_SYSTEM = `You are a strategic decision engine built for Product Managers.

Your purpose: Structure market signals into actionable strategic judgment.

You must:
- Avoid fluff.
- Avoid marketing language.
- Avoid exaggerated confidence.
- Clearly distinguish signals, assumptions, and risks.
- If data is uncertain, state it as hypothesis.

OUTPUT: Return ONLY valid JSON. No extra text.`

export const STRATEGIC_OUTPUT_SCHEMA = `{
  "market_score": number (0-100),
  "market_phase": "emerging | growing | mature | saturated | declining",
  "confidence_level": "low | medium | high",
  "summary": "2-3 sentence strategic interpretation",
  "signal_breakdown": {
    "positive_signals": [{ "signal": "", "impact": "low | medium | high", "explanation": "" }],
    "neutral_signals": [{ "signal": "", "impact": "low | medium | high", "explanation": "" }],
    "risk_signals": [{ "signal": "", "severity": "low | medium | high", "explanation": "" }]
  },
  "market_structure": {
    "competition_density": "low | medium | high",
    "dominant_players_exist": true/false,
    "fragmentation_level": "low | medium | high",
    "entry_barrier": "low | medium | high",
    "summary": ""
  },
  "competitive_landscape": [{ "name": "", "positioning": "", "strength": "", "weakness": "" }],
  "strategic_actions": {
    "immediate": [{ "action": "", "priority": "low | medium | high", "expected_impact": "" }],
    "mid_term": [{ "action": "", "priority": "low | medium | high", "expected_impact": "" }],
    "risk_mitigation": [{ "action": "", "priority": "low | medium | high", "risk_addressed": "" }]
  },
  "key_uncertainties": [""],
  "full_report": ""
}`

export const STRATEGIC_SCORING_RULES = `Market Score: 0-30 structurally weak/declining; 31-50 uncertain; 51-70 viable but competitive; 71-85 strong growth potential; 86-100 exceptional (rare). Do NOT inflate scores.`

export const STRATEGIC_REASONING_RULES = `1. Base on: demand signals, competitive intensity, investment trends, regulatory risks, market maturity.
2. Include at least 2 positive + 2 risk signals.
3. If speculative: lower confidence_level, mention uncertainty in summary.
4. Actions: concrete, testable, time-bound when possible.
5. Avoid generic advice ("improve marketing", "focus on users", "innovate"). Be specific.`

export const STRATEGIC_FULL_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT FORMAT (STRICT JSON ONLY):

${STRATEGIC_OUTPUT_SCHEMA}

SCORING RULES:
${STRATEGIC_SCORING_RULES}

REASONING RULES:
${STRATEGIC_REASONING_RULES}

CRITICAL: Return ONLY valid JSON. No extra text. All string content (summary, signals, actions, explanations) must be in Korean.`

export function buildStrategicPrompt(keyword: string, mode: string, newsTitles: string[]): string {
  const block = newsTitles.length
    ? `News headlines:\n${newsTitles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
    : ''
  return `${block}INPUT:
Keyword: ${keyword}
Mode: ${mode}

Analyze the market. Return ONLY the JSON object. No markdown, no commentary.`
}

/** Task 2: Detect trend patterns from news */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: { "market_score": number 0-100, "summary": "2-3 sentences", "positive_signals": ["signal1","signal2"], "neutral_signals": ["signal1"] }
All content in Korean.`

export function buildTaskTrendsPrompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length
    ? `News headlines:\n${newsTitles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
    : ''
  return `${block}Keyword: ${keyword}
Analyze trend patterns and growth signals from the news. Return ONLY the JSON object.`
}

/** Task 3: Analyze competition from trends */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: { "competitive_landscape": [{ "name": "", "positioning": "" }], "market_structure": { "summary": "" } }
All content in Korean.`

export function buildTaskCompetitionPrompt(keyword: string, trendSummary: string): string {
  return `Keyword: ${keyword}
Trend summary: ${trendSummary}

Identify competitors and competitive landscape. Return ONLY the JSON object.`
}

/** Task 4: Evaluate risks */
export const TASK_RISKS_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: { "risk_signals": ["risk1","risk2"], "key_uncertainties": ["uncertainty1"] }
All content in Korean.`

export function buildTaskRisksPrompt(
  keyword: string,
  trendSummary: string,
  competitionSummary: string
): string {
  return `Keyword: ${keyword}
Trends: ${trendSummary}
Competition: ${competitionSummary}

Identify market risks and key uncertainties. Return ONLY the JSON object.`
}

/** Strategy Layer: opportunities, risks, strategy summary */
export const STRATEGY_LAYER_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: {
  "opportunities": ["opportunity1", "opportunity2"],
  "risks": ["risk1", "risk2"],
  "strategy_summary": "2-3 sentence PM-level strategy summary"
}
All content in Korean.`

export function buildStrategyLayerPrompt(
  keyword: string,
  trendSummary: string,
  competitionSummary: string
): string {
  return `Keyword: ${keyword}
Trends: ${trendSummary}
Competition: ${competitionSummary}

Identify product opportunities, market risks, and a brief strategy summary. Return ONLY the JSON object.`
}

/** Execution Layer: product actions, feature ideas, GTM steps */
export const EXECUTION_LAYER_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: {
  "product_actions": [{ "action": "", "priority": "high|medium|low", "reasoning": "" }],
  "feature_ideas": ["idea1", "idea2", "idea3"],
  "go_to_market_steps": ["step1", "step2"]
}
All content in Korean. Be concrete and actionable.`

export function buildExecutionLayerPrompt(
  keyword: string,
  strategySummary: string,
  opportunitiesSummary: string,
  risksSummary: string
): string {
  return `Keyword: ${keyword}
Strategy: ${strategySummary}
Opportunities: ${opportunitiesSummary}
Risks: ${risksSummary}

Generate actionable product actions, feature ideas, and go-to-market steps. Return ONLY the JSON object.`
}

/** Opportunity Score - PM market attractiveness (0-100) with signed breakdown and reasoning */
export const OPPORTUNITY_SCORE_SYSTEM = `You are a product strategy analyst. Given market analysis, calculate an Opportunity Score (0-100) representing how attractive the market/product opportunity is for a PM.

OUTPUT: Return ONLY valid JSON. No extra text.
Format: {
  "opportunity_score": number (0-100),
  "market_growth": number (contribution, e.g. +30 = positive factor),
  "competition_density": number (contribution, typically negative, e.g. -10),
  "trend_momentum": number (contribution, e.g. +20),
  "funding_signals": number (contribution, e.g. +15),
  "risk_factors": number (contribution, typically negative, e.g. -5),
  "score_reasoning": "1-2 sentence AI explanation in Korean. Example: '검색 성장과 스타트업 활동이 활발하나, 대형 SaaS 기업 경쟁으로 기회 점수가 낮아집니다.'"
}

Contributions can be positive or negative. They conceptually explain what adds or subtracts from the base opportunity.
score_reasoning: Explain the score in plain language. Reference search growth, competition, trends, funding, risks.`

export function buildOpportunityScorePrompt(
  keyword: string,
  trendSummary: string,
  competitionSummary: string,
  opportunitiesSummary: string,
  risksSummary: string
): string {
  return `Keyword: ${keyword}
Trends: ${trendSummary}
Competition: ${competitionSummary}
Opportunities: ${opportunitiesSummary}
Risks: ${risksSummary}

Calculate the Opportunity Score and breakdown. Return ONLY the JSON object.`
}

/** Task 5: Generate strategy (legacy - strategic_actions) */
export const TASK_STRATEGY_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: { "strategic_actions": { "immediate": [{ "action": "", "priority": "high|medium|low", "expected_impact": "" }], "mid_term": [], "risk_mitigation": [] } }
All content in Korean.`

export function buildTaskStrategyPrompt(
  keyword: string,
  trendSummary: string,
  competitionSummary: string,
  risksSummary: string
): string {
  return `Keyword: ${keyword}
Trends: ${trendSummary}
Competition: ${competitionSummary}
Risks: ${risksSummary}

Generate PM-focused strategic actions. Return ONLY the JSON object.`
}
