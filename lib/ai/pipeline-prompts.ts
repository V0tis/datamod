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
  /** DATA에서 뽑은 정량 근거 한 줄(수치·점유·검색 지수 등) */
  quantitative_evidence?: string
  /** 뉴스 톤·커뮤니티·경쟁 행보 등 정성 근거 한 줄 */
  qualitative_evidence?: string
}

/** 인사이트 추출 — 리스크 시그널 */
export type RiskSignalItem = {
  risk: string
  severity: number
  likelihood: number
  quantitative_evidence?: string
  qualitative_evidence?: string
  /** 완화 가능성: 상=완화 여지 큼, 하=완화 어려움 */
  mitigation_level?: '상' | '중' | '하'
  mitigation_plan?: string
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
      const qe = typeof o.quantitative_evidence === 'string' ? o.quantitative_evidence.trim() : ''
      const ql = typeof o.qualitative_evidence === 'string' ? o.qualitative_evidence.trim() : ''
      out.push({
        signal,
        impact_level: parseImpactLevel(o.impact_level),
        ...(qe.length >= 4 ? { quantitative_evidence: qe } : {}),
        ...(ql.length >= 4 ? { qualitative_evidence: ql } : {}),
      })
    }
  }
  return out
}

function parseMitigationLevel(v: unknown): '상' | '중' | '하' | undefined {
  if (v === '상' || v === '중' || v === '하') return v
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (/^high|^상|^upper|^h$/.test(s)) return '상'
  if (/^low|^하|^lower|^l$/.test(s)) return '하'
  if (/^med|^medium|^중|^m$/.test(s)) return '중'
  return undefined
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
      const qe = typeof o.quantitative_evidence === 'string' ? o.quantitative_evidence.trim() : ''
      const ql = typeof o.qualitative_evidence === 'string' ? o.qualitative_evidence.trim() : ''
      const mp = typeof o.mitigation_plan === 'string' ? o.mitigation_plan.trim() : ''
      const ml = parseMitigationLevel(o.mitigation_level)
      out.push({
        risk,
        severity: clampInsightScore1to10(o.severity),
        likelihood: clampInsightScore1to10(o.likelihood),
        ...(qe.length >= 4 ? { quantitative_evidence: qe } : {}),
        ...(ql.length >= 4 ? { qualitative_evidence: ql } : {}),
        ...(ml ? { mitigation_level: ml } : {}),
        ...(mp.length >= 6 ? { mitigation_plan: mp } : {}),
      })
    }
  }
  return out
}

/** 전략 프롬프트·fallback용 문자열 리스트 */
export function flattenOpportunitySignalsForPrompt(items: readonly OpportunitySignalItem[] | undefined): string[] {
  if (!items?.length) return []
  return items
    .map((x) => {
      const base = `[${x.impact_level}] ${x.signal}`.trim()
      if (!x.quantitative_evidence && !x.qualitative_evidence) return base
      return `${base} — 정량: ${x.quantitative_evidence ?? '—'}; 정성: ${x.qualitative_evidence ?? '—'}`
    })
    .filter(Boolean)
}

export function flattenRiskSignalsForPrompt(items: readonly RiskSignalItem[] | undefined): string[] {
  if (!items?.length) return []
  return items
    .map((x) => {
      const base = `${x.risk} (심각도 ${x.severity}/10, 발생 가능성 ${x.likelihood}/10)`.trim()
      const mit =
        x.mitigation_level || x.mitigation_plan
          ? ` 완화가능성 ${x.mitigation_level ?? '?'}${x.mitigation_plan ? `: ${x.mitigation_plan}` : ''}`
          : ''
      const q = [x.quantitative_evidence, x.qualitative_evidence].filter(Boolean).join(' / ')
      return q ? `${base}${mit} [근거: ${q}]` : `${base}${mit}`
    })
    .filter(Boolean)
}

export const PIPELINE_BASE_SYSTEM = `${BASE_JSON_PROMPT}

역할: PM 의사결정 지원 파이프라인(채팅 UI 아님).
사용자 메시지는 KEYWORD / COLLECTED_DATA / TASK / RULES 블록으로 온다. 답은 오직 RULES와 스키마에 맞는 JSON 한 덩어리.
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- summary·insight·impact·opportunity·risk·strategy·action에 해당하는 정보 밀도를 유지한다.`

/** 리스크·기회 평가(전략 평가 단계) JSON — risk_items / opportunity_items 정규화용 */
export type StrategyEvalRiskItem = {
  issue: string
  mitigation_level: string
  plan: string
}

export type StrategyEvalOpportunityItem = {
  value: string
  difficulty_level: string
  priority: number
}

export function clampCrossValidationScore(n: unknown): number | undefined {
  const v = typeof n === 'number' ? n : typeof n === 'string' ? parseFloat(String(n).replace(/%/g, '').trim()) : NaN
  if (!Number.isFinite(v)) return undefined
  return Math.min(100, Math.max(0, Math.round(v)))
}

function normalizeMitigationLevelForDisplay(v: unknown): string {
  const m = parseMitigationLevel(v)
  if (m) return m
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (s === 'high' || s === 'h') return '상'
  if (s === 'low' || s === 'l') return '하'
  if (s === 'medium' || s === 'm') return '중'
  return typeof v === 'string' && v.trim() ? v.trim() : '중'
}

function normalizeDifficultyLevelForDisplay(v: unknown): string {
  if (v === '고' || v === '중' || v === '저') return v
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (/^high|^hard|^상|^높|^고/.test(s)) return '고'
  if (/^low|^easy|^저|^낮|^쉬/.test(s)) return '저'
  if (/^med|^medium|^중/.test(s)) return '중'
  return typeof v === 'string' && v.trim() ? v.trim() : '중'
}

export function normalizeStrategyEvalRiskItems(raw: unknown): StrategyEvalRiskItem[] {
  if (!Array.isArray(raw)) return []
  const out: StrategyEvalRiskItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const issueRaw = typeof o.issue === 'string' ? o.issue.trim() : typeof o.risk === 'string' ? o.risk.trim() : ''
    if (issueRaw.length < 6) continue
    const plan = typeof o.plan === 'string' ? o.plan.trim() : typeof o.mitigation === 'string' ? o.mitigation.trim() : ''
    if (plan.length < 8) continue
    out.push({
      issue: issueRaw,
      mitigation_level: normalizeMitigationLevelForDisplay(o.mitigation_level),
      plan,
    })
  }
  return out.slice(0, 6)
}

export function normalizeStrategyEvalOpportunityItems(raw: unknown): StrategyEvalOpportunityItem[] {
  if (!Array.isArray(raw)) return []
  const out: StrategyEvalOpportunityItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const valueRaw =
      typeof o.value === 'string' ? o.value.trim() : typeof o.opportunity === 'string' ? o.opportunity.trim() : ''
    if (valueRaw.length < 6) continue
    const pr = typeof o.priority === 'number' ? o.priority : parseInt(String(o.priority ?? ''), 10)
    const priority = Number.isFinite(pr) ? Math.min(99, Math.max(1, Math.round(pr as number))) : 5
    out.push({
      value: valueRaw,
      difficulty_level: normalizeDifficultyLevelForDisplay(o.difficulty_level),
      priority,
    })
  }
  return out.slice(0, 6).sort((a, b) => a.priority - b.priority)
}

/** Step 3: Insight Extraction – title, summary, why important, business impact, PM decision meaning. DATA-DRIVEN ONLY. */
export const INSIGHT_EXTRACTION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
인사이트는 PM이 바로 우선순위·실험·리소스 배분에 쓸 수 있게 쓴다. ${INNOVATION_INSTRUCTION}

**가설 교차검증 원칙(필수):** 각 기회·리스크는 DATA에서 **정량 근거**(점유·검색·채택·가격 등 수치·비교)와 **정성 근거**(뉴스 톤, 커뮤니티 반응, 경쟁사 최근 행보)를 **한 쌍**으로 연결한다. "리스크가 존재한다" 같은 모호한 문장 금지.

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
    {
      "signal": "기회 내용",
      "impact_level": "High" | "Medium" | "Low",
      "quantitative_evidence": "정량 근거 한 줄 (예: 검색 지수 상승, 점유 추정치)",
      "qualitative_evidence": "정성 근거 한 줄 (예: 뉴스/커뮤니티에서 드러난 니즈)"
    }
  ],
  "risk_signals": [
    {
      "risk": "리스크 내용",
      "severity": number,
      "likelihood": number,
      "quantitative_evidence": "정량 근거 한 줄",
      "qualitative_evidence": "정성 근거 한 줄",
      "mitigation_level": "상" | "중" | "하",
      "mitigation_plan": "구체 완화 행동 한 줄 (제품/운영/가격/파트너 중 실제 조치)"
    }
  ]
}
- opportunity_signals.signal: 한국어. impact_level: 파싱을 위해 정확히 "High", "Medium", "Low" 중 하나만 쓴다. quantitative_evidence·qualitative_evidence는 가능한 한 채운다(없으면 DATA 한계를 한 줄로 명시).
- risk_signals: risk는 한국어. severity·likelihood는 1~10 정수, DATA 근거로 산정. mitigation_level은 **상=완화 여지 큼, 하=완화 어려움**. mitigation_plan은 실행 가능한 한 줄.
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
    task: `위 COLLECTED_DATA만 근거로 core_insights 3~5개를 추출한다. 각 core_insight는 impact(파급)와 reason(다음 실행)에 DATA 인용 수준의 구체성을 넣는다. opportunity_signals·risk_signals에는 정량·정성 근거 쌍과(가능하면) 리스크의 mitigation_level·mitigation_plan을 반드시 채운다. 모호한 서술 금지.`,
    suffix: `Return ONLY the JSON object per system format. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Step 4: Strategic Recommendation – why this strategy, expected result, risk, difficulty, priority. DATA-DRIVEN ONLY. */
export const STRATEGIC_RECOMMENDATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
전략은 제공된 DATA와 앞 단계 인사이트에만 기대어 쓴다. 원론(차별화 필요 등)만 말하지 말고, DATA에 나온 경쟁사·수치·이벤트를 빌려 "누구의 어떤 약점·지연·가격·채널을 어떻게 공략할지"까지 문장으로 연결한다.

**가설 교차검증·실행 설계:** opportunities·risks 각 문자열 안에 (1) 정량 신호 요약 (2) 정성 신호 요약 (3) 그에 따른 전략 함의를 **한 문장**으로 압축한다. "리스크가 존재함" 금지. 예: "A사 점유 우위(정량) 대비 커뮤니티 이탈 논의 확산(정성) → 무료 콘텐츠로 전환 비용 낮춤 필요".
문체: "~할 수 있습니다", "~존재하며" 같은 장황한 설명체 금지. 명사형 종결·간결한 보고체(예: "~을 통한 ~ 확보", "~집중 구조", "~대비 공백") 우선.
${PM_REQUIRED_OUTPUT_STRUCTURE}
Format: {
  "opportunities": ["기회 (DATA 근거·파급·실행 힌트)", "..."],
  "risks": ["리스크 (파급·완화 시나리오 힌트)", "..."],
  "three_line_actions": [
    "1) 현상: 주요 경쟁사 포지셔닝·수익/제품 구조상 문제점 한 줄 (구체 사명·행태 인용, 120자 이하)",
    "2) 기회: 우리가 선점 가능한 니치·공백(경쟁사 미흡 영역) 한 줄 (120자 이하)",
    "3) 실행: 이번 분기 최우선 Action Item 한 줄(MVP·실험·지표 중심, 120자 이하)"
  ],
  "background_rationale": "마크다운. ## 배경 및 근거 로 시작. 시장·경쟁·트렌드 DATA만 근거로 서술. 문장은 명사형·짧은 구절 종결(예: \"~존재\", \"~구조\", \"~대비 공백\")을 우선한다. 실행 액션·로드맵 문장은 넣지 않는다(three_line_actions와 중복 금지).",
  "strategy_summary": "레거시 호환: 비우거나 background_rationale을 요약한 짧은 문자열만. 신규 필드가 있으면 비워도 됨.",
  "market_summary": "1~2문장. situation·meaning·impact가 한 번에 읽히게.",
  "key_strategic_insights": ["전략 인사이트: 이유·파급·PM이 내일 할 일"]
}
- three_line_actions는 반드시 3개 문자열. 순서는 [현상 → 기회 → 실행]만. 각 120자 이하. 접두 번호(1)2)3))는 생략해도 되고, 넣어도 된다.
- background_rationale에만 마크다운 헤더·불릿을 넣는다.
- opportunities·risks는 문자열 배열로 유지한다.
Return ONLY valid JSON. 본문은 한국어.`

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
    task: `위 DATA만으로 전략 JSON을 채운다. opportunities·risks·market_summary에는 DATA 속 사실·비교·인용이 드러나게 쓰고, 각 항목은 정량·정성 신호를 한 문장에 엮는다. three_line_actions는 PM용 [현상(경쟁·문제) → 기회(니치) → 실행(최우선 액션)] 3문장만 채운다. background_rationale에는 시장·경쟁 근거만 넣는다(액션·로드맵 문장과 three_line 중복 금지). strategy_summary는 비우거나 한 줄 요약만.`,
    suffix: `Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Step 5: PM Action Plan – 슬림 JSON, 토큰 절약. DATA-DRIVEN ONLY. */
export const PM_ACTION_PLAN_SYSTEM = `${PIPELINE_BASE_SYSTEM}
반드시 하나의 유효한 JSON 객체만 출력한다(마크다운 펜스·전후 설명 없음).
액션 플랜은 앞 단계 전략·기회·리스크 DATA에만 기대어 쓴다.
토큰 절약을 위해 문장은 짧은 구와 불릿 수준으로. 값이 없는 키·빈 배열·빈 객체는 출력에서 생략한다.

**필수 구조(실행 가능성):** \`pm_action_plan\` 배열에 **정확히 5개** 항목을 채운다. 각 항목은 구체적이고 실행 가능한(actionable) 전략이어야 하며, 다음 필드를 모두 채운다: action_title(한 줄 행동), description(무엇을·어떻게·범위), expected_outcome(측정 가능한 결과), **estimated_timeline(필수, 한국어로 예상 실행 기간만 — 예: 1주, 2주, 1개월, 3개월)**, priority(high|medium|low), category(mvp_experiment|user_interview|feature_prioritization|go_to_market 중 하나).
추상적 구호·중복 항목 금지. 각 액션은 PM이 이번 주 안에 착수할 수 있는 수준으로 쓴다.

Preferred format (슬림 출력: 아래 키 위주로 채우고, 중복 배열·불필요한 장문 필드는 생략):
{
  "goal": "목표 한 문장 (필수)",
  "pm_action_plan": [
    { "action_title": "…", "description": "…", "expected_outcome": "…", "estimated_timeline": "2주", "priority": "high", "category": "mvp_experiment" }
  ],
  "steps": ["실행 단계1", "실행 단계2", "실행 단계3"],
  "priority_action": {
    "action": "가장 시급한 단일 액션",
    "reasoning": "근거 (한두 문장)",
    "expected_outcome": "기대 결과 (한두 문장)"
  },
  "strategic_decision_layer": {
    "opportunity_score_reason_text": "한 문장(120~220자 권장). 국내 시니어 PM 보고체. **결론적**으로 시장 상태·경쟁·수요·리스크·타이밍 중 무엇이 이 키워드의 매력/장벽을 지배하는지만 서술한다. **금지**: 긍정 시그널 N건·경쟁사 N곳 같은 **건수·항목 나열**, '기회 점수를 산출/반영했습니다'·'(NN/100)' 같은 **메타·산식 문장**, COLLECTED_DATA 밖의 추정.",
    "market_opportunity_explanation": "레거시 호환: opportunity_score_reason_text와 **동일 문장**을 넣는다(둘 중 하나만 채울 경우 reason_text 쪽을 채운다).",
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
- **pm_action_plan은 반드시 5개 항목**(위 actionable 규칙 준수). 각 항목의 **estimated_timeline**은 빈 값 금지(한국어 기간).
- priority_action은 **하나**만 (최우선 1건).
- strategic_decision_layer: **opportunity_score_reason_text**와 market_opportunity_explanation은 동일 한 문장으로 맞춘다(비우지 말 것). 이 문장은 점수 **건수 요약이 아니라** 시장의 결론적 해석만 담는다.
- strategic_decision_layer·swot_analysis 각 필드 값은 짧게 (항목당 1줄 권장).
- jtbd: functional_jobs·social_jobs·emotional_jobs 각 **2~4개** 짧은 구(한국어). pains/main_jobs와 중복되지 않게 역할을 나눈다.
- porter_5_forces: 각 힘마다 근거 배열 1~2문장. scores의 각 값은 **1~5 정수**(5=해당 힘이 매우 강함/산업 수익 압박 큼). 점수는 **다른 힘과의 상대 비교로만 낮추지 말고**, DATA에 드러난 **절대적 산업 구조·규제·전환비용·대체 가능성** 등의 가치를 기준으로 평가한다. 근거가 분명하면 보수적으로 2~3에 몰아두지 말고 4~5를 과감히 부여할 수 있다.
Required: goal, **pm_action_plan(정확히 5개)**, priority_action (action 필수), steps(1개 이상 권장, 최대 6). strategic_decision_layer·swot_analysis·jtbd·porter_5_forces는 DATA가 있으면 채운다. All text in Korean.`

/** PM 액션 단계용: 긴 전략·기회·리스크 텍스트를 핵심 요약본으로 잘라 토큰·실패율을 낮춘다. */
/** PM 액션 단계에 주입: 기회 점수 산식과 맞는 건수(모델이 reason 문장에 숫자 나열로 복붙하지 않도록 안내용) */
export type PmActionOpportunityFacts = {
  positive_signals_count: number
  neutral_signals_count: number
  competitor_count: number
  strategy_opportunities_count: number
  strategy_risks_count: number
}

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
  risksSummary: string,
  opportunityFacts?: PmActionOpportunityFacts | null
): string {
  const strat = compressTextForPmActionInput(strategySummary ?? '', 1400)
  const opp = compressTextForPmActionInput(opportunitiesSummary ?? '', 700)
  const risk = compressTextForPmActionInput(risksSummary ?? '', 700)
  const facts =
    opportunityFacts != null
      ? [
          'OPPORTUNITY_SCORE_FACTS (검증·맥락용. **이 블록의 숫자·건수를 JSON 출력에 그대로 복사하지 말 것** — strategic_decision_layer.opportunity_score_reason_text에는 건수 나열 금지):',
          `- 긍정 시그널: ${opportunityFacts.positive_signals_count}건`,
          `- 중립 시그널: ${opportunityFacts.neutral_signals_count}건`,
          `- 경쟁사(랜드스케이프): ${opportunityFacts.competitor_count}곳`,
          `- 전략상 기회(문항 수): ${opportunityFacts.strategy_opportunities_count}건`,
          `- 전략상 리스크(문항 수): ${opportunityFacts.strategy_risks_count}건`,
        ].join('\n')
      : ''
  const collectedData = [
    strat && `strategy summary (핵심 요약본):\n${strat}`,
    opp && `opportunities (핵심 요약본):\n${opp}`,
    risk && `risks (핵심 요약본):\n${risk}`,
    facts,
  ]
    .filter(Boolean)
    .join('\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `위 DATA는 이미 압축된 핵심 요약본이다. 이 DATA만으로 슬림 스키마를 채운다: goal, **pm_action_plan 정확히 5개(actionable)**, steps(최대 6), priority_action, strategic_decision_layer, swot_analysis, jtbd, porter_5_forces. 전략·기회·리스크 문맥을 SWOT·포터·JTBD·5개 액션에 일관되게 반영한다. strategic_decision_layer의 opportunity_score_reason_text는 OPPORTUNITY_SCORE_FACTS의 숫자를 나열하지 말고, 시장의 결론적 상태만 한 문장으로 쓴다.`,
    suffix: `응답은 유효 JSON 객체 하나만. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** 전략 추천 + PM 액션 — 단일 LLM 호출용 (전략·실행 상호 정렬). */
export const STRATEGY_EXECUTION_BUNDLE_SYSTEM = `${STRATEGIC_RECOMMENDATION_SYSTEM}

---

번들 규칙: **같은 응답** 안에서 (1) strategy 객체를 DATA·인사이트로 완성한 뒤 (2) execution 객체를 그 strategy와 논리적으로 일치하게 채운다(모순·중복 서술 금지).

${PM_ACTION_PLAN_SYSTEM}

【루트 출력 형식】 오직 하나의 JSON 객체이며 최상위 키는 **strategy** 와 **execution** 두 개만 허용한다.
- strategy: 위 STRATEGIC_RECOMMENDATION_SYSTEM의 Format·필수 규칙을 그대로 따른다.
- execution: 위 PM_ACTION_PLAN_SYSTEM의 슬림 스키마·필수 규칙을 따르며, strategy에서 도출한 기회·리스크·요약을 반영한다.
Return ONLY: { "strategy": { ... }, "execution": { ... } }. 본문은 한국어.`

export function buildStrategyExecutionBundlePrompt(
  keyword: string,
  marketOverview: string,
  competitionSummary: string,
  extractedInsights: {
    key_insights?: string[]
    opportunity_signals?: OpportunitySignalItem[]
    risk_signals?: RiskSignalItem[]
  },
  opportunityFacts?: PmActionOpportunityFacts | null
): string {
  const insights = [
    ...(extractedInsights.key_insights ?? []),
    ...flattenOpportunitySignalsForPrompt(extractedInsights.opportunity_signals),
    ...flattenRiskSignalsForPrompt(extractedInsights.risk_signals),
  ].filter(Boolean)
  const insightsBlock = insights.length
    ? `extracted insights (from prior step):\n${insights.map((i) => `- ${i}`).join('\n')}`
    : ''
  const strategyInput = [
    marketOverview?.trim() && `market overview:\n${marketOverview.trim()}`,
    competitionSummary?.trim() && `competition:\n${competitionSummary.trim()}`,
    insightsBlock,
  ]
    .filter(Boolean)
    .join('\n\n')

  const facts =
    opportunityFacts != null
      ? [
          'OPPORTUNITY_SCORE_FACTS (검증·맥락용. **이 블록의 숫자·건수를 JSON에 그대로 복사하지 말 것** — execution.strategic_decision_layer.opportunity_score_reason_text에는 건수 나열 금지):',
          `- 긍정 시그널: ${opportunityFacts.positive_signals_count}건`,
          `- 중립 시그널: ${opportunityFacts.neutral_signals_count}건`,
          `- 경쟁사(랜드스케이프): ${opportunityFacts.competitor_count}곳`,
          `- 전략상 기회(문항 수): ${opportunityFacts.strategy_opportunities_count}건`,
          `- 전략상 리스크(문항 수): ${opportunityFacts.strategy_risks_count}건`,
        ].join('\n')
      : ''

  const collectedData = [strategyInput, facts].filter((s) => s.trim().length > 0).join('\n\n---\n\n')
  if (!collectedData.trim()) return ''
  return buildDataDrivenPrompt({
    keyword,
    sections: { collectedData },
    task: `COLLECTED_DATA로 strategy를 완성한 뒤, 동일 응답의 execution을 채운다. execution은 strategy의 opportunities·risks·요약과 execution용 FACTS 블록에 정렬된다. strategy의 three_line_actions·background_rationale 규칙과 execution의 pm_action_plan(5개)·priority_action·steps 규칙을 모두 만족한다.`,
    suffix: `Return ONLY the root object { "strategy": {...}, "execution": {...} }. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Strategy Evaluation – score + reason supporting PM decision. DATA-DRIVEN ONLY. */
export const STRATEGY_EVALUATION_SYSTEM = `${PIPELINE_BASE_SYSTEM}
**전략 원칙:** (1) 전략 가설을 정량 신호(시장·검색·채택·점유 등)와 정성 신호(뉴스 톤·커뮤니티·경쟁 행보)로 **대조**해 일치도를 수치화한다. (2) 리스크는 나열이 아니라 **완화 가능성(상/중/하)**과 **구체 대응 plan**을 반드시 쌍으로 쓴다. (3) 기회는 가치뿐 아니라 **실행 난이도(고/중/저)**와 **priority(숫자, 1이 최우선)**로 투입 대비 성과 관점의 순위를 제시한다.
모호한 문장 금지. 이유·issue·value에는 "정량 근거 + 정성 근거"가 한 문장에 드러나게.

제공된 DATA와 앞 단계 요약만으로 아래 JSON을 **모두** 채운다. 각 차원은 점수·라벨·이유를 한 세트로 채운다.
이유(reason)에는 왜 그 점수인지·파급이 PM 회의에서 바로 인용되게 한두 문장으로.

Format: {
  "cross_validation_score": number (0~100, 정량·정성 신호의 방향 일치도·근거 밀도 기반),
  "cross_validation_summary": "한 문장. 어떤 정량 신호와 어떤 정성 신호가 가설을 어떻게 뒷받침/반박하는지",
  "risk_items": [
    { "issue": "이슈 한 문장(정량·정성 신호 연결)", "mitigation_level": "상" | "중" | "하", "plan": "구체 완화·대응 방안 한두 문장" }
  ],
  "opportunity_items": [
    { "value": "기회 한 문장(정량·정성 연결)", "difficulty_level": "고" | "중" | "저", "priority": number }
  ],
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
- risk_items: **2~4개**. mitigation_level: **상=완화 여지 큼, 하=완화 어려움**. plan은 제품/운영/가격 등 실행형.
- opportunity_items: **2~4개**. difficulty_level: **고=실행 매우 어려움, 저=상대적으로 쉬움**. priority: **1이 가장 우선**(동률 시 value의 임팩트로 판단).
- cross_validation_score: 근거가 강하고 정·정성 방향이 맞을수록 높게(80+), 정성만 약하거나 상충하면 낮게.
All dimension scores integers 1-10. All _label and _reason in Korean with business meaning. Return ONLY valid JSON.`

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
    task: `위 DATA만으로 cross_validation_score·cross_validation_summary·risk_items·opportunity_items와 네 차원 점수·각 _reason을 채운다. 리스크·기회 항목은 정량·정성 신호를 issue/value 문장에 녹인다.`,
    suffix: `Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}
