/**
 * Canonical PM analysis prompts – PM decision support, not chatbot.
 * All outputs must reflect: summary, insight, impact, opportunity, risk, strategy, action.
 */
import { PM_ANALYSIS_JSON_SCHEMA } from './pm-analysis-schema'
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX, PM_ROLE_INSTRUCTION, PM_THINKING_ORDER, PM_STRUCTURED_RULE, PM_REQUIRED_OUTPUT_STRUCTURE } from './base-prompt'

export const PM_INPUT_RULES = `입력 처리:
- 분석 대상을 사용자에게 묻지 않음. 키워드·페이로드에서 자율 추론.
- analysis_target: product | company | market | person | policy | technology
- analysis_scope: market | sentiment | momentum | risk | opportunity
- 입력이 모호하면 최선의 추론을 진행하고 meta.confidence_score·meta.analysis_quality로 불확실성 표시.
- 질문 금지. "제공해 주세요" 등 대화형 표현 금지.`

export const PM_OUTPUT_RULES = `출력 규칙:
- 결정적·실행 수준 문장 사용. "~인 것으로 보인다", "~할 수 있다", "잠재적으로" 등 회피.
- JSON만 출력. 마크다운, 이모지, 추가 텍스트, 질문 금지.
- 반드시 meta, market_temperature, insights, pm_actions 네 객체 포함.
- facts: 검증 가능한 사실
- hypotheses: 가정 (검증 필요)
- inferences: 논리적 해석
- market_temperature.explanation: positive_signals, neutral_signals, negative_risks 각 배열.
- 세 레이어(facts/hypotheses/inferences) 혼용 금지.`

/** System instruction for initial news-based research. */
export const INITIAL_RESEARCH_SYSTEM = `${BASE_JSON_PROMPT}

${PM_ROLE_INSTRUCTION}
${PM_THINKING_ORDER}
${PM_STRUCTURED_RULE}
${PM_REQUIRED_OUTPUT_STRUCTURE}
시장 리서치 전문가. 제공된 뉴스 제목만 참고하여 분석. 컨설팅 보고서 수준. 한국 PM이 읽는 문서처럼. 단순 요약 금지.

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

규칙: facts 3~5개, hypotheses 0~3개, inferences 2~4개.
- recommended_actions: 2~4개 객체. 각 { title, reasoning, urgency_level: low|medium|high, related_risk? }
- monitoring_points: 1~3개, decision_risks: 1~3개
- positive_signals/neutral_signals/negative_risks 각 1~3개.
- meta.generated_at: 현재 시각 ISO 8601.
- 질문 금지. 컨텍스트 자율 추론.`
}

/** System instruction for consensus synthesis (Gemini + Groq markdown). */
export const CONSENSUS_SYNTHESIS_SYSTEM = `${BASE_JSON_PROMPT}

PM 전략 수립 분석가. 제공된 두 AI 분석 텍스트만 바탕으로 종합. 검색·외부 데이터 사용 금지. 출력은 summary, insight, impact, reason, risk, opportunity, strategy를 포함. 컨설팅 보고서 수준.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`

/** System instruction for grounding-based research (web search). */
export const GROUNDING_RESEARCH_SYSTEM = `${BASE_JSON_PROMPT}

${PM_ROLE_INSTRUCTION}
${PM_THINKING_ORDER}
${PM_STRUCTURED_RULE}
시장 리서치 전문가. 검색 결과만 참고하여 분석. 상황·의미·영향·기회·리스크·전략·액션 포함. 컨설팅 보고서 수준. 단순 요약 금지.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`
