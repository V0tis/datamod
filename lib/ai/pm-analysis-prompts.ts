/**
 * Canonical PM analysis prompts.
 * - No conversational language, no questions, no markdown/emojis.
 * - AI infers analysis_target and analysis_scope from input.
 * - Output is strict JSON only.
 */
import { PM_ANALYSIS_JSON_SCHEMA } from './pm-analysis-schema'

export const PM_INPUT_RULES = `입력 처리:
- 분석 대상을 사용자에게 묻지 않음. 페이로드와 키워드에서 추론.
- analysis_target: product | company | market | person | policy | technology
- analysis_scope: market | sentiment | momentum | risk | opportunity
- 입력이 모호하면 최선의 추론을 진행하고 meta.confidence_score와 meta.analysis_quality로 불확실성 표시.
- 질문하지 않음. "제공해 주세요" 등 대화형 표현 사용 금지.`

export const PM_OUTPUT_RULES = `출력 규칙:
- JSON만 출력. 마크다운, 이모지, 추가 텍스트 금지.
- facts: 검증 가능한 사실 또는 명확한 사실
- hypotheses: 가정이며 검증 필요 (명시적 레이블)
- inferences: 논리적 해석
- 세 레이어를 혼용하지 않음.`

/** System instruction for initial news-based research. */
export const INITIAL_RESEARCH_SYSTEM = `시장 리서치 전문가. 제공된 뉴스 제목만 참고하여 분석. JSON만 출력.

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
  return `${newsBlock}키워드 "${keyword}"에 대해 위 뉴스만 바탕으로 분석. JSON만 출력.

규칙: facts 3~5개, hypotheses 0~3개, inferences 2~4개, recommended_actions 2~4개, positive_signals/neutral_signals/negative_risks 각 1~3개, meta.generated_at은 현재 시각 ISO 8601.`
}

/** System instruction for consensus synthesis (Gemini + Groq markdown). */
export const CONSENSUS_SYNTHESIS_SYSTEM = `PM 전략 수립 분석가. 제공된 두 AI 분석 텍스트만 바탕으로 종합. 검색·외부 데이터 사용 금지. JSON만 출력.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`

/** System instruction for grounding-based research (web search). */
export const GROUNDING_RESEARCH_SYSTEM = `시장 리서치 전문가. 검색 결과만 참고하여 분석. JSON만 출력.

${PM_INPUT_RULES}
${PM_OUTPUT_RULES}

JSON 스키마:
${PM_ANALYSIS_JSON_SCHEMA}`
