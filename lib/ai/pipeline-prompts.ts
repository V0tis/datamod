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

역할: PM 의사결정 지원 파이프라인(채팅 UI 아님).
사용자 메시지는 KEYWORD / COLLECTED_DATA / TASK / RULES 블록으로 온다. 답은 오직 RULES와 스키마에 맞는 JSON 한 덩어리.
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- summary·insight·impact·opportunity·risk·strategy·action에 해당하는 정보 밀도를 유지한다.`

/** Step 3: Insight Extraction – title, summary, why important, business impact, PM decision meaning. DATA-DRIVEN ONLY. */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
인사이트는 PM이 바로 우선순위·실험·리소스 배분에 쓸 수 있게 쓴다. ${INNOVATION_INSTRUCTION}

1. "core_insights": 3~5개. 각 항목은 다음을 모두 채운다:
   - "title": 5~15자 헤드라인. summary와 같은 문장을 반복하지 않는다.
   - "summary": 1~2문장. DATA 속 관찰과 "그래서 왜 중요한가"를 연결한다.
   - "impact": 매출·점유·진입 타이밍·단가·규제 등 DATA가 허용하는 파급을 구체적으로.
   - "reason": 이번 주·스프린트 안에서 PM이 할 수 있는 판단·실험·검증 행동으로 연결.
   - "score": 선택, 1~10.
   - "source_timestamp": 선택, ISO 8601 문자열. DATA·뉴스 인용 시점이 명확하면 그 기준 시각을 넣는다. 생략 시 서버가 분석 완료 시각을 사용한다.

2. "key_insights", "opportunity_signals", "risk_signals" 배열을 DATA에서 채운다.

Format: {
  "core_insights": [
    { "title": "제목", "summary": "요약", "impact": "비즈니스 영향", "reason": "의사결정·실행 연결", "source_timestamp": "2026-04-08T03:00:00.000Z" }
  ],
  "key_insights": ["문자열"],
  "opportunity_signals": [
    { "signal": "기회 내용", "impact_level": "High" | "Medium" | "Low" }
  ],
  "risk_signals": [
    { "risk": "리스크 내용", "severity": number, "likelihood": number }
  ]
}
- opportunity_signals.signal: 한국어. impact_level: 파싱을 위해 정확히 "High", "Medium", "Low" 중 하나만 쓴다.
- risk_signals: risk는 한국어. severity·likelihood는 1~10 정수, DATA 근거로 산정.
Return ONLY valid JSON. 본문 필드는 한국어.`

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
    task: `위 COLLECTED_DATA만 근거로 core_insights 3~5개를 추출한다. 각 core_insight는 impact(파급)와 reason(다음 실행)에 DATA 인용 수준의 구체성을 넣는다. key_insights·opportunity_signals·risk_signals도 같은 DATA에만 기대어 채운다. 동일 문장 반복·빈 필드는 피한다.`,
    suffix: `Return ONLY the JSON object per system format. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Step 4: Strategic Recommendation – why this strategy, expected result, risk, difficulty, priority. DATA-DRIVEN ONLY. */
export const STRATEGIC_RECOMMENDATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
전략은 제공된 DATA와 앞 단계 인사이트에만 기대어 쓴다. 원론(차별화 필요 등)만 말하지 말고, DATA에 나온 경쟁사·수치·이벤트를 빌려 "누구의 어떤 약점·지연·가격·채널을 어떻게 공략할지"까지 문장으로 연결한다.
반드시 드러낼 것: 전략을 택한 이유(why), 기대 결과, 리스크, 실행 난이도, 우선순위.
${PM_REQUIRED_OUTPUT_STRUCTURE}
Format: {
  "opportunities": ["기회 (DATA 근거·파급·실행 힌트)", "..."],
  "risks": ["리스크 (파급·완화 시나리오 힌트)", "..."],
  "strategy_summary": "마크다운 전략 보고를 **하나의 JSON 문자열**로만 담는다. 구조: (1) ## 배경 (2) ## 핵심 전략 (3) ## 예상 효과. 각 본문은 불릿(- 또는 *). why·기대 결과·리스크·난이도·우선순위를 세 섹션에 나누어 쓴다.",
  "market_summary": "1~2문장. situation·meaning·impact가 한 번에 읽히게.",
  "key_strategic_insights": ["전략 인사이트: 이유·파급·PM이 내일 할 일"]
}
- strategy_summary 문자열 안에만 마크다운을 넣고, JSON 이스케이프 규칙을 지킨다.
- opportunities·risks는 문자열 배열로 유지한다.
Return ONLY valid JSON. 본문은 한국어. 섹션 헤더는 ## 배경 / ## 핵심 전략 / ## 예상 효과.`

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
    task: `위 DATA만으로 전략 JSON을 채운다. opportunities·risks·market_summary에는 DATA 속 사실·비교·인용이 드러나게 쓴다. strategy_summary 한 문자열 안에 ## 배경 / ## 핵심 전략 / ## 예상 효과와 불릿을 넣고, 경쟁이 언급되면 DATA에 근거한 취약점 공략·틈새 진입을 구체 문장으로 넣는다(원론적 차별화 구호만 쓰지 않는다).`,
    suffix: `Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Step 5: PM Action Plan – 슬림 JSON, 토큰 절약. DATA-DRIVEN ONLY. */
export const PM_ACTION_PLAN_SYSTEM = `${PIPELINE_BASE_SYSTEM}
반드시 하나의 유효한 JSON 객체만 출력한다(마크다운 펜스·전후 설명 없음).
액션 플랜은 앞 단계 전략·기회·리스크 DATA에만 기대어 쓴다.
토큰 절약을 위해 문장은 짧은 구와 불릿 수준으로. 값이 없는 키·빈 배열·빈 객체는 출력에서 생략한다.

**필수 구조(실행 가능성):** \`pm_action_plan\` 배열에 **정확히 5개** 항목을 채운다. 각 항목은 구체적이고 실행 가능한(actionable) 전략이어야 하며, 다음 필드를 모두 채운다: action_title(한 줄 행동), description(무엇을·어떻게·기한/범위), expected_outcome(측정 가능한 결과), priority(high|medium|low), category(mvp_experiment|user_interview|feature_prioritization|go_to_market 중 하나).
추상적 구호·중복 항목 금지. 각 액션은 PM이 이번 주 안에 착수할 수 있는 수준으로 쓴다.

Preferred format (슬림 출력: 아래 키 위주로 채우고, 중복 배열·불필요한 장문 필드는 생략):
{
  "goal": "목표 한 문장 (필수)",
  "pm_action_plan": [
    { "action_title": "…", "description": "…", "expected_outcome": "…", "priority": "high", "category": "mvp_experiment" }
  ],
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
  "swot_analysis": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
  "jtbd": {
    "functional_jobs": ["업무·효율 관점에서 사용자가 달성하려는 핵심 과제"],
    "social_jobs": ["타인·조직·규범과의 관계에서의 니즈"],
    "emotional_jobs": ["정서·불안·만족과 관련된 근본 동기"]
  },
  "porter_5_forces": {
    "new_entrants": ["진입 위협 근거 한 줄"],
    "supplier_power": ["공급자 교섭력 근거"],
    "buyer_power": ["구매자 교섭력 근거"],
    "substitutes": ["대체재·대안 근거"],
    "rivalry": ["기존 경쟁 강도 근거"],
    "scores": {
      "new_entrants": 3,
      "supplier_power": 3,
      "buyer_power": 3,
      "substitutes": 3,
      "rivalry": 3
    }
  }
}
- steps는 **최대 6개**까지. 핵심 실행 순서만.
- **pm_action_plan은 반드시 5개 항목**(위 actionable 규칙 준수).
- priority_action은 **하나**만 (최우선 1건).
- strategic_decision_layer·swot_analysis 각 필드 값은 짧게 (항목당 1줄 권장).
- jtbd: functional_jobs·social_jobs·emotional_jobs 각 **2~4개** 짧은 구(한국어). pains/main_jobs와 중복되지 않게 역할을 나눈다.
- porter_5_forces: 각 힘마다 근거 배열 1~2문장. scores의 각 값은 **1~5 정수**(5=해당 힘이 매우 강함/산업 수익 압박 큼). 점수는 **다른 힘과의 상대 비교로만 낮추지 말고**, DATA에 드러난 **절대적 산업 구조·규제·전환비용·대체 가능성** 등의 가치를 기준으로 평가한다. 근거가 분명하면 보수적으로 2~3에 몰아두지 말고 4~5를 과감히 부여할 수 있다.
Required: goal, **pm_action_plan(정확히 5개)**, priority_action (action 필수), steps(1개 이상 권장, 최대 6). strategic_decision_layer·swot_analysis·jtbd·porter_5_forces는 DATA가 있으면 채운다. All text in Korean.`

/** PM 액션 단계용: 긴 전략·기회·리스크 텍스트를 핵심 요약본으로 잘라 토큰·실패율을 낮춘다. */
export function compressTextForPmActionInput(text: string, maxChars: number): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= maxChars) return t
  const cut = t.slice(0, maxChars)
  const lastBreak = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('。'), cut.lastIndexOf('\n'))
  const base = lastBreak > maxChars * 0.5 ? cut.slice(0, lastBreak + 1).trim() : cut.trim()
  return `${base}…`
}

export function buildPMActionPlanPrompt(
  keyword: string,
  strategySummary: string,
  opportunitiesSummary: string,
  risksSummary: string
): string {
  const strat = compressTextForPmActionInput(strategySummary ?? '', 1400)
  const opp = compressTextForPmActionInput(opportunitiesSummary ?? '', 700)
  const risk = compressTextForPmActionInput(risksSummary ?? '', 700)
  const collectedData = [
    strat && `strategy summary (핵심 요약본):\n${strat}`,
    opp && `opportunities (핵심 요약본):\n${opp}`,
    risk && `risks (핵심 요약본):\n${risk}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `위 DATA는 이미 압축된 핵심 요약본이다. 이 DATA만으로 슬림 스키마를 채운다: goal, **pm_action_plan 정확히 5개(actionable)**, steps(최대 6), priority_action, strategic_decision_layer, swot_analysis, jtbd, porter_5_forces. 전략·기회·리스크 문맥을 SWOT·포터·JTBD·5개 액션에 일관되게 반영한다.`,
    suffix: `응답은 유효 JSON 객체 하나만. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Strategy Evaluation – score + reason supporting PM decision. DATA-DRIVEN ONLY. */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
제공된 DATA와 앞 단계 요약만으로 네 차원을 평가한다. 각 차원은 점수·라벨·이유를 한 세트로 채운다.
이유(reason)에는 왜 그 점수인지·파급·기회/리스크가 PM 회의에서 바로 인용되게 한두 문장으로.
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
    task: `위 DATA만으로 1~10 정수 점수와 각 _reason을 채운다. 이유 문장에 DATA에 나온 요소(경쟁·수치·이벤트)를 끌어와 구체성을 준다.`,
    suffix: `Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}
