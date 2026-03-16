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

You are a strategic market analyst for Product Managers. Output must feel like a consulting report: insight-driven, with reasoning, impact, risk, and opportunity.`

/** Step 3: Insight Extraction – each insight has title, summary, impact, reason. No duplicates, no empty, no repeated text. */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
You must return TWO structures:

1. "core_insights": array of 3-5 PM-ready insights. Each item MUST have:
   - "title": short phrase (5-15 chars, e.g. "시장 성장성", "경쟁 강도"). Unique. Do NOT copy summary text.
   - "summary": 1-2 sentences describing the insight. Must be DIFFERENT from title. No repetition.
   - "impact": business impact (e.g. "매출·점유율에 직접 영향", "진입 타이밍 결정"). Do NOT leave empty.
   - "reason": why this matters for PM / product (e.g. "우선순위 결정 근거"). Do NOT leave empty.
   - "score": optional number 1-10.

Rules: No duplicates across insights. No empty title/summary/impact/reason. No repeated text between title and summary. Each field unique, non-empty Korean. If missing any field → invalid.

2. Legacy arrays (for downstream): "key_insights", "opportunity_signals", "risk_signals".

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

Extract 3-5 core_insights: each must have title, summary, impact, reason. No duplicates, no empty fields, no repeated text. Also return key_insights, opportunity_signals, risk_signals. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Step 4: Strategic Recommendation – must include summary, insight, impact, reason, risk, opportunity, strategy */
export const STRATEGIC_RECOMMENDATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Output must include: summary (시장·전략 요약), insight (핵심 인사이트), impact (비즈니스 영향), reason (근거), risk, opportunity, strategy. Explain why, impact, risk, opportunity. Suggest strategy and rationale.
Format: {
  "opportunities": ["기회1 (근거·영향 포함)", "기회2", "기회3"],
  "risks": ["리스크1 (영향·대응 방향)", "리스크2", "리스크3"],
  "strategy_summary": "2-3문장 제품 전략 요약 (근거·영향 포함)",
  "market_summary": "1-2문장 시장 요약 (인사이트 중심)",
  "key_strategic_insights": ["전략 인사이트1 (이유·영향)", "전략 인사이트2", "전략 인사이트3"]
}
Each field must add business meaning and reasoning. Return ONLY valid JSON. All text in Korean.`

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

Produce strategic recommendations: include summary, insight, impact, reason, risk, opportunity, strategy. Explain why and suggest strategy. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Step 5: PM Action Plan – must include goal, steps, priority, risk, expected result */
export const PM_ACTION_PLAN_SYSTEM = `${PIPELINE_BASE_SYSTEM}
You MUST return a valid JSON object. No markdown, no code fences, no extra text.
Action plan must include: goal (목표), steps (실행 단계 배열), priority (우선순위), risk (주요 리스크), expected result (기대 결과). Explain why and impact for each action.

Preferred format (include at least pm_action_plan or steps):
{
  "goal": "목표 한 문장 (필수)",
  "steps": ["실행 단계1", "실행 단계2", "..."],
  "priority": "high|medium|low 또는 한글 우선순위",
  "risk": "주요 리스크 한 문장",
  "expected_outcome": "기대 결과 요약 (또는 pm_action_plan 각 항목의 expected_outcome)",
  "product_idea": "구체적 제품 컨셉",
  "target_customer": "타겟 고객 세그먼트",
  "monetization": "수익화 모델",
  "product_actions": [{"action": "액션명", "priority": "high|medium|low", "reasoning": "근거"}],
  "feature_ideas": ["아이디어1", "아이디어2"],
  "go_to_market_steps": ["GTM 단계1", "GTM 단계2"],
  "pm_action_plan": [{
    "action_title": "액션 제목",
    "description": "구체적 실행 방법",
    "expected_outcome": "기대 결과 (필수)",
    "priority": "high|medium|low",
    "category": "mvp_experiment|user_interview|feature_prioritization|go_to_market"
  }],
  "next_actions_pm": [{"action": "액션명", "why": "이유", "how_to_execute": "실행 방법", "priority": "high|medium|low"}],
  "strategic_decision_layer": {
    "market_opportunity_explanation": "한 줄",
    "competition_intensity": "low|medium|high",
    "competition_explanation": "한 줄",
    "product_market_fit": "low|medium|high",
    "product_market_fit_explanation": "한 줄",
    "entry_strategy": "진입 전략 요약",
    "entry_explanation": "한 줄"
  },
  "swot_analysis": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
  "jtbd": { "main_jobs": [], "pains": [], "gains": [] }
}
Required: goal, steps or pm_action_plan (4-8 items), priority, risk, expected result (goal-level or per action). All text in Korean. If missing required fields → invalid.`

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

Generate actionable PM plan. Must include: goal, steps (or pm_action_plan), priority, risk, expected result. Explain why and expected impact. Return ONLY a valid JSON object. No markdown. ${KOREAN_ONLY_SUFFIX}`
}

/** Strategy Evaluation – score 1-10 + label + reason (score reason) per dimension */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
Evaluate the generated strategy. For each dimension return: score (1-10), label, and reason (why this score, impact, risk/opportunity). Output must support PM decision with score reason.
Format: {
  "market_attractiveness": number (1=low, 10=high),
  "market_attractiveness_label": "한 단어 라벨 (예: 높음/보통/낮음)",
  "market_attractiveness_reason": "점수 이유·영향 한 줄 (근거 필수)",
  "competition_risk": number (1=low risk, 10=high risk),
  "competition_risk_label": "한 단어 라벨",
  "competition_risk_reason": "점수 이유·영향 한 줄",
  "execution_difficulty": number (1=easy, 10=very hard),
  "execution_difficulty_label": "한 단어 라벨",
  "execution_difficulty_reason": "점수 이유·영향 한 줄",
  "growth_potential": number (1=low, 10=high),
  "growth_potential_label": "한 단어 라벨",
  "growth_potential_reason": "점수 이유·영향 한 줄"
}
All scores integers 1-10. All _label and _reason in Korean with business meaning. Return ONLY valid JSON.`

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

Evaluate this strategy. For each dimension return score, label, and reason (score reason with impact). Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}
