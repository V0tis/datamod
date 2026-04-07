/**
 * Multi-step AI Analysis Pipeline - PM decision support.
 * Each step follows PM thinking: situation → meaning → impact → opportunity → risk → strategy → action.
 */
import {
  BASE_JSON_PROMPT,
  KOREAN_ONLY_SUFFIX,
  PM_THINKING_ORDER,
  PM_STRUCTURED_RULE,
  PM_REQUIRED_OUTPUT_STRUCTURE,
  INNOVATION_INSTRUCTION,
  buildDataDrivenPrompt,
} from './base-prompt'

/** 인사이트 추출 — 기회 시그널 (전략 단계·프롬프트 플랫닝에 사용) */
export type OpportunitySignalItem = {
  signal: string
  impact_level: 'High' | 'Medium' | 'Low'
}

/** 인사이트 추출 — 리스크 시그널 */
export type RiskSignalItem = {
  risk: string
  severity: number
  likelihood: number
}

function clampInsightScore1to10(n: unknown, fallback = 5): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback
  return Math.min(10, Math.max(1, Math.round(n)))
}

function parseImpactLevel(v: unknown): 'High' | 'Medium' | 'Low' {
  if (v === 'High' || v === 'Medium' || v === 'Low') return v
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (/^high|^상|^높/.test(s)) return 'High'
  if (/^low|^하|^낮/.test(s)) return 'Low'
  return 'Medium'
}

/** AI JSON 파싱 직후: 레거시 string[] + 신규 객체 배열 모두 수용 */
export function normalizeOpportunitySignalsFromParse(raw: unknown[] | undefined | null): OpportunitySignalItem[] {
  if (!Array.isArray(raw)) return []
  const out: OpportunitySignalItem[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = item.trim()
      if (t) out.push({ signal: t, impact_level: 'Medium' })
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const signal = typeof o.signal === 'string' ? o.signal.trim() : ''
      if (!signal) continue
      out.push({ signal, impact_level: parseImpactLevel(o.impact_level) })
    }
  }
  return out
}

export function normalizeRiskSignalsFromParse(raw: unknown[] | undefined | null): RiskSignalItem[] {
  if (!Array.isArray(raw)) return []
  const out: RiskSignalItem[] = []
  for (const item of raw) {
    if (typeof item === 'string') {
      const t = item.trim()
      if (t) out.push({ risk: t, severity: 5, likelihood: 5 })
      continue
    }
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>
      const risk = typeof o.risk === 'string' ? o.risk.trim() : ''
      if (!risk) continue
      out.push({
        risk,
        severity: clampInsightScore1to10(o.severity),
        likelihood: clampInsightScore1to10(o.likelihood),
      })
    }
  }
  return out
}

/** 전략 프롬프트·fallback용 문자열 리스트 */
export function flattenOpportunitySignalsForPrompt(items: readonly OpportunitySignalItem[] | undefined): string[] {
  if (!items?.length) return []
  return items.map((x) => `[${x.impact_level}] ${x.signal}`.trim()).filter(Boolean)
}

export function flattenRiskSignalsForPrompt(items: readonly RiskSignalItem[] | undefined): string[] {
  if (!items?.length) return []
  return items
    .map((x) => `${x.risk} (심각도 ${x.severity}/10, 발생 가능성 ${x.likelihood}/10)`.trim())
    .filter(Boolean)
}

export const PIPELINE_BASE_SYSTEM = `${BASE_JSON_PROMPT}

PM 의사결정 지원용 파이프라인입니다. 챗봇이 아닙니다.
사용자 메시지는 INPUT / DATA / TASK / RULES 형식이다. DATA에 있는 내용만 근거로 한다. RULES를 반드시 준수한다.
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- 분석은 summary, insight, impact, opportunity, risk, strategy, action을 반영해야 합니다. 누락 시 무효.`

/** Step 3: Insight Extraction – title, summary, why important, business impact, PM decision meaning. DATA-DRIVEN ONLY. */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
인사이트는 PM이 의사결정에 쓸 수 있게 작성하세요. ${INNOVATION_INSTRUCTION}

필수: 제공된 DATA에서만 추출. 추측·발명·할루시네이션 금지. DATA에 없는 내용을 만들지 마세요.

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
  "opportunity_signals": [
    { "signal": "기회 내용", "impact_level": "High" | "Medium" | "Low" }
  ],
  "risk_signals": [
    { "risk": "리스크 내용", "severity": number, "likelihood": number }
  ]
}
- opportunity_signals: signal은 한국어. impact_level은 파싱 일관성을 위해 반드시 영문 "High", "Medium", "Low" 중 하나만 사용 (다른 표기 금지).
- risk_signals: risk는 한국어. severity·likelihood는 정수 1-10 (심각도·발생 가능성). DATA 근거로 산정.
Return ONLY valid JSON. signal·risk·key_insights·core_insights 본문은 한국어.`

export function buildInsightExtractionPrompt(
  keyword: string,
  marketOverview: string,
  competitionSummary: string
): string {
  const collectedData = [
    marketOverview?.trim() && `trend / market overview (from prior step):\n${marketOverview.trim()}`,
    competitionSummary?.trim() && `competition summary (from prior step):\n${competitionSummary.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `Extract 3-5 core_insights using ONLY the DATA above. key_insights, opportunity_signals (signal + impact_level), risk_signals (risk + severity + likelihood) must be grounded in DATA. No duplicates, no empty fields.`,
    suffix: `Return ONLY the JSON object per system format. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Step 4: Strategic Recommendation – why this strategy, expected result, risk, difficulty, priority. DATA-DRIVEN ONLY. */
export const STRATEGIC_RECOMMENDATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
전략 제안은 반드시 제공된 DATA를 근거로 작성. 추측·발명·할루시네이션 금지.
전략 제안은 반드시 포함: 왜 이 전략인지(why), 기대 결과(expected result), 리스크(risk), 실행 난이도(difficulty), 우선순위(priority).
${PM_REQUIRED_OUTPUT_STRUCTURE}
Format: {
  "opportunities": ["기회 (근거·영향)", "..."],
  "risks": ["리스크 (영향·대응)", "..."],
  "strategy_summary": "마크다운(Markdown) 전략 보고서를 **하나의 JSON 문자열 값**으로만 출력. 필수 구조: (1) ## 배경 (2) ## 핵심 전략 (3) ## 예상 효과 — 위 순서를 지키고, 각 섹션 본문은 불릿(- 또는 *)으로 항목화. 왜 이 전략인지·기대 결과·리스크·난이도·우선순위는 세 섹션에 분배해 서술.",
  "market_summary": "1-2문장 시장 요약 (상황·의미·영향)",
  "key_strategic_insights": ["전략 인사이트 (이유·영향·PM 의사결정 의미)"]
}
- strategy_summary는 유효한 JSON 객체 **안의 문자열 필드**에만 마크다운을 넣는다 (문자열 내부 줄바꿈은 JSON 규칙에 따라 이스케이프).
- opportunities·risks는 문자열 배열을 유지한다 (추후 객체 배열 확장 가능).
Each field must support PM decision. Return ONLY valid JSON. 서술·불릿 본문은 한국어. 섹션 제목은 반드시 ## 배경 / ## 핵심 전략 / ## 예상 효과 형태의 마크다운 헤더를 사용한다.`

export function buildStrategicRecommendationPrompt(
  keyword: string,
  marketOverview: string,
  competitionSummary: string,
  extractedInsights: {
    key_insights?: string[]
    opportunity_signals?: OpportunitySignalItem[]
    risk_signals?: RiskSignalItem[]
  }
): string {
  const insights = [
    ...(extractedInsights.key_insights ?? []),
    ...flattenOpportunitySignalsForPrompt(extractedInsights.opportunity_signals),
    ...flattenRiskSignalsForPrompt(extractedInsights.risk_signals),
  ].filter(Boolean)
  const insightsBlock = insights.length
    ? `extracted insights (from prior step):\n${insights.map((i) => `- ${i}`).join('\n')}`
    : ''
  const collectedData = [
    marketOverview?.trim() && `market overview:\n${marketOverview.trim()}`,
    competitionSummary?.trim() && `competition:\n${competitionSummary.trim()}`,
    insightsBlock,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `Produce strategic recommendations using ONLY the DATA above. opportunities, risks, market_summary must cite DATA. strategy_summary must be a Markdown report inside one JSON string with sections ## 배경, ## 핵심 전략, ## 예상 효과 and bullet lists; include why, expected result, risk, difficulty, priority within those sections.`,
    suffix: `Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Step 5: PM Action Plan – 슬림 JSON, 토큰 절약. DATA-DRIVEN ONLY. */
export const PM_ACTION_PLAN_SYSTEM = `${PIPELINE_BASE_SYSTEM}
You MUST return a valid JSON object. No markdown, no code fences, no extra text.
액션 플랜은 반드시 제공된 DATA를 근거로 작성. 추측·발명·할루시네이션 금지.
Keep descriptions concise to avoid token overflow. 짧은 구·불릿 수준으로 작성. 빈 배열·빈 객체는 보내지 말 것.

Preferred format (이 키만 사용 권장 — 중복 배열·장문 필드 금지):
{
  "goal": "목표 한 문장 (필수)",
  "steps": ["실행 단계1", "실행 단계2", "실행 단계3"],
  "priority_action": {
    "action": "가장 시급한 단일 액션",
    "reasoning": "근거 (한두 문장)",
    "expected_outcome": "기대 결과 (한두 문장)"
  },
  "strategic_decision_layer": {
    "market_opportunity_explanation": "한 줄",
    "competition_intensity": "low|medium|high",
    "competition_explanation": "한 줄",
    "product_market_fit": "low|medium|high",
    "product_market_fit_explanation": "한 줄",
    "entry_strategy": "진입 전략 요약",
    "entry_explanation": "한 줄"
  },
  "swot_analysis": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] }
}
- steps는 **최대 6개**까지. 핵심 실행 순서만.
- priority_action은 **하나**만 (최우선 1건).
- strategic_decision_layer·swot_analysis 각 필드 값은 짧게 (항목당 1줄 권장).
Required: goal, priority_action (action 필수), steps(1개 이상 권장, 최대 6). strategic_decision_layer·swot_analysis는 DATA가 있으면 채운다. All text in Korean.`

export function buildPMActionPlanPrompt(
  keyword: string,
  strategySummary: string,
  opportunitiesSummary: string,
  risksSummary: string
): string {
  const collectedData = [
    strategySummary?.trim() && `strategy summary:\n${strategySummary.trim()}`,
    opportunitiesSummary?.trim() && `opportunities:\n${opportunitiesSummary.trim()}`,
    risksSummary?.trim() && `risks:\n${risksSummary.trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `Generate PM action plan using ONLY the DATA above. Use the slim schema: goal, steps (max 6), priority_action, strategic_decision_layer, swot_analysis. Be concise. No duplicate action lists.`,
    suffix: `Return ONLY a valid JSON object. No markdown. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Strategy Evaluation – score + reason supporting PM decision. DATA-DRIVEN ONLY. */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
전략을 PM 사고 순서로 평가. 반드시 제공된 DATA를 근거로 점수 산정. 추측·발명 금지.
상황·의미·영향·기회·리스크를 반영한 점수와 이유를 제시하세요.
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
  const actionsBlock = productActions.length
    ? `product actions (from prior step):\n${productActions.slice(0, 5).map((a, i) => `${i + 1}. ${a}`).join('\n')}`
    : ''
  const collectedData = [
    strategySummary?.trim() && `strategy:\n${strategySummary.trim()}`,
    opportunitiesSummary?.trim() && `opportunities:\n${opportunitiesSummary.trim()}`,
    risksSummary?.trim() && `risks:\n${risksSummary.trim()}`,
    competitionSummary?.trim() && `competition:\n${competitionSummary.trim()}`,
    actionsBlock,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `Evaluate strategy using ONLY the DATA above. Scores (1-10) and _reason fields must cite DATA. Do not invent dimensions or numbers.`,
    suffix: `Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}
