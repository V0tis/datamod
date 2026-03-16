/**
 * Multi-step AI Analysis Pipeline - PM decision support.
 * Each step follows PM thinking: situation → meaning → impact → opportunity → risk → strategy → action.
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX, PM_THINKING_ORDER, PM_STRUCTURED_RULE, PM_REQUIRED_OUTPUT_STRUCTURE, INNOVATION_INSTRUCTION } from './base-prompt'

export const PIPELINE_BASE_SYSTEM = `${BASE_JSON_PROMPT}

PM 의사결정 지원용 파이프라인입니다. 챗봇이 아닙니다.
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- 분석은 summary, insight, impact, opportunity, risk, strategy, action을 반영해야 합니다. 누락 시 무효.`

/** Step 3: Insight Extraction – title, summary, why important, business impact, PM decision meaning */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
인사이트는 PM이 의사결정에 쓸 수 있게 작성하세요. ${INNOVATION_INSTRUCTION}

1. "core_insights": 3-5개. 각 항목 필수:
   - "title": 짧은 제목 (5-15자). 요약 문장과 중복 금지.
   - "summary": 1-2문장 (무슨 일인지, 왜 중요한지).
   - "impact": 비즈니스 영향 (매출·점유율·진입 타이밍 등). 비어 있으면 무효.
   - "reason": PM 의사결정에 주는 의미(why important, PM decision meaning). 비어 있으면 무효.
   - "score": optional 1-10.

Rules: 중복·빈값·동일 문장 반복 금지. title과 summary는 서로 달라야 함. 누락 시 무효.

2. "key_insights", "opportunity_signals", "risk_signals" 배열.

Format: {
  "core_insights": [
    { "title": "제목", "summary": "요약(왜 중요한지)", "impact": "비즈니스 영향", "reason": "PM 의사결정 의미" }
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

Extract 3-5 core_insights: each with title, summary, why important, business impact, PM decision meaning. No duplicates, no empty. Also key_insights, opportunity_signals, risk_signals. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Step 4: Strategic Recommendation – why this strategy, expected result, risk, difficulty, priority */
export const STRATEGIC_RECOMMENDATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
전략 제안은 반드시 포함: 왜 이 전략인지(why), 기대 결과(expected result), 리스크(risk), 실행 난이도(difficulty), 우선순위(priority).
${PM_REQUIRED_OUTPUT_STRUCTURE}
Format: {
  "opportunities": ["기회 (근거·영향)"],
  "risks": ["리스크 (영향·대응)"],
  "strategy_summary": "2-3문장 전략 요약 (왜 이 전략인지, 기대 결과, 리스크, 난이도, 우선순위 포함)",
  "market_summary": "1-2문장 시장 요약 (상황·의미·영향)",
  "key_strategic_insights": ["전략 인사이트 (이유·영향·PM 의사결정 의미)"]
}
Each field must support PM decision. Return ONLY valid JSON. All text in Korean.`

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

Produce strategy: include why this strategy, expected result, risk, difficulty, priority. summary, insight, impact, opportunity, risk, strategy, action을 반영. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Step 5: PM Action Plan – goal, step-by-step plan, priority, risk, expected impact */
export const PM_ACTION_PLAN_SYSTEM = `${PIPELINE_BASE_SYSTEM}
You MUST return a valid JSON object. No markdown, no code fences, no extra text.
액션 플랜 필수: goal(목표), step-by-step plan(단계별 실행 계획), priority(우선순위), risk(리스크), expected impact(기대 영향). 각 액션에 왜·영향을 포함.

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
Required: goal, step-by-step plan (steps or pm_action_plan 4-8 items), priority, risk, expected impact. 누락 시 무효. All text in Korean.`

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

Generate PM action plan: goal, step-by-step plan, priority, risk, expected impact. 각 단계에 왜·기대 영향 포함. Return ONLY a valid JSON object. No markdown. ${KOREAN_ONLY_SUFFIX}`
}

/** Strategy Evaluation – score + reason supporting PM decision */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
전략을 PM 사고 순서로 평가: 상황·의미·영향·기회·리스크를 반영한 점수와 이유를 제시하세요.
For each dimension: score (1-10), label, reason (why this score, impact, risk/opportunity). PM 의사결정에 쓸 수 있는 근거 필수.
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
