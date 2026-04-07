/**
 * Canonical PM analysis prompts – PM decision support, not chatbot.
 * All outputs must reflect: summary, insight, impact, opportunity, risk, strategy, action.
 */
import { PM_ANALYSIS_JSON_SCHEMA } from './pm-analysis-schema'
import {
  BASE_JSON_PROMPT,
  KOREAN_ONLY_SUFFIX,
  LANGUAGE_LOCK_TOP,
  UTF8_ENCODING_RULE,
  PM_ROLE_INSTRUCTION,
  PM_THINKING_ORDER,
  PM_STRUCTURED_RULE,
  PM_REQUIRED_OUTPUT_STRUCTURE,
} from './base-prompt'

export const PM_INPUT_RULES = `입력 처리:
- 분석 대상은 사용자에게 묻지 않고 키워드·페이로드에서 추론한다.
- analysis_target: product | company | market | person | policy | technology
- analysis_scope: market | sentiment | momentum | risk | opportunity
- 입력이 모호하면 최선의 추론을 진행하고 meta.confidence_score·meta.analysis_quality로 불확실성을 수치화한다.
- 응답 본문은 완결된 분석만: "제공해 주세요" 같은 대화 유도 문장은 쓰지 않는다.`

export const PM_OUTPUT_RULES = `출력 규칙:
- ${LANGUAGE_LOCK_TOP} ${UTF8_ENCODING_RULE}
- 실행 가능한 문장 위주로 쓴다.
- JSON만 출력한다. 마크다운 펜스·이모지·전후 잡담 없이 스키마에 맞는 객체 하나.
- meta, market_temperature, insights, pm_actions 네 최상위 객체를 스키마대로 채운다.
- facts: 검증 가능한 사실
- hypotheses: 검증이 필요한 가정
- inferences: 논리적 해석
- market_temperature.explanation: positive_signals, neutral_signals, negative_risks 배열로 정리
- facts / hypotheses / inferences 역할을 섞지 않고 레이블에 맞게 배치한다.`

/** System instruction for initial news-based research. */
export const INITIAL_RESEARCH_SYSTEM = `${BASE_JSON_PROMPT}

${PM_ROLE_INSTRUCTION}
${PM_THINKING_ORDER}
${PM_STRUCTURED_RULE}
${PM_REQUIRED_OUTPUT_STRUCTURE}
시장 리서치 분석가. 제공된 뉴스 제목·요약 범위 안에서만 분석한다. PM이 읽는 국내 기획 보고 톤으로, 파급과 다음 액션 힌트가 보이게 쓴다.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`

/** Build user prompt for initial research (news titles). */
export function buildInitialResearchUserPrompt(keyword: string, newsTitles: string[]): string {
  const newsBlock =
    newsTitles.length > 0
      ? `[뉴스 제목]\n${newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
      : ''
  return `${newsBlock}키워드 "${keyword}"에 대해 위 뉴스만 바탕으로 분석. JSON만 출력. ${KOREAN_ONLY_SUFFIX}

채울 것: facts 3~5, hypotheses 0~3, inferences 2~4.
- recommended_actions: 2~4개 객체. 각 { title, reasoning, urgency_level: low|medium|high, related_risk? }
- monitoring_points: 1~3, decision_risks: 1~3
- positive_signals/neutral_signals/negative_risks 각 1~3
- meta.generated_at: 현재 시각 ISO 8601
- 컨텍스트는 스스로 추론하고 완결된 JSON으로 마친다.`
}

/** System instruction for consensus synthesis (Gemini + Groq markdown). */
export const CONSENSUS_SYNTHESIS_SYSTEM = `${BASE_JSON_PROMPT}

${LANGUAGE_LOCK_TOP}
PM 전략 종합 분석가. 아래에 주어질 두 AI 분석 텍스트만 근거로 종합한다. 외부 검색·추가 사실을 만들어 내지 않는다.
출력에는 summary, insight, impact, reason, risk, opportunity, strategy가 드러나게 담는다.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`

/** System instruction for grounding-based research (web search). */
export const GROUNDING_RESEARCH_SYSTEM = `${BASE_JSON_PROMPT}

${PM_ROLE_INSTRUCTION}
${PM_THINKING_ORDER}
${PM_STRUCTURED_RULE}
시장 리서치 분석가. 검색 결과로 제공된 텍스트 범위 안에서만 분석한다. 상황·의미·영향·기회·리스크·전략·액션이 한 흐름으로 읽히게.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`
