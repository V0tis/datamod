/**
 * PM Strategic Analysis Prompt – PM decision support, not chatbot.
 * Follow PM thinking: situation → meaning → impact → opportunity → risk → strategy → action.
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX, PM_THINKING_ORDER, PM_STRUCTURED_RULE, INNOVATION_INSTRUCTION } from './base-prompt'

export const STRATEGIC_SYSTEM = `${BASE_JSON_PROMPT}

PM 의사결정 지원용 분석 엔진입니다. 챗봇이 아닙니다.
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- ${INNOVATION_INSTRUCTION}
- 상황·의미·영향·기회·리스크·전략·액션을 구체적으로 제시하세요. 단순 요약 금지.`

/** Task 2: Trend analysis – PM thinking order, market temperature, opportunity/risk */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

트렌드 분석도 PM 사고 순서를 따르세요: 무슨 일이 일어나는지 → 왜 중요한지 → 시장 영향 → 기회 → 리스크.
summary에는 situation·meaning·impact를, positive_signals에는 기회·비즈니스 의미를, neutral_signals에는 관찰을 담으세요. market_score에 대한 근거를 포함하세요.
Format: { "market_score": number 0-100, "summary": "2-3문장 (상황·의미·영향 포함)", "positive_signals": ["시그널과 기회/비즈니스 의미"], "neutral_signals": ["중립 관찰"] }
Return ONLY valid JSON. All text in Korean.`

export function buildTaskTrendsPrompt(
  keyword: string,
  newsTitles: string[],
  webContext?: string
): string {
  const newsBlock = newsTitles.length
    ? `News headlines:\n${newsTitles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
    : ''
  const webBlock =
    webContext && webContext.trim()
      ? `Web search context (use for grounding):\n${webContext.trim()}\n\n`
      : ''
  return `${webBlock}${newsBlock}Keyword: ${keyword}
PM 사고 순서로 분석: 무슨 일이 일어나는가, 왜 중요한가, 시장 영향, 기회, 리스크. 새로운 사업 기회·숨은 리스크 관점으로 작성. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Task 3: Competition analysis – PM thinking, hidden opportunity, weak competitor */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

경쟁 분석도 PM 사고 순서와 혁신 관점을 따르세요. 시장 공백, 약한 경쟁자, 신규 진입 기회를 찾으세요.
competitive_landscape 각 항목은 PM 전략 수립에 쓸 수 있게: strength·weakness는 기회·리스크 관점으로 구체화.
Format: {
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝 (1문장)",
    "target_market": "타겟 시장",
    "key_feature": "핵심 기능/차별점",
    "pricing": "가격 모델",
    "differentiation": "차별화 포인트",
    "strength": "강점 (1문장)",
    "weakness": "약점 (1문장, PM이 활용할 기회·진입 포인트)"
  }],
  "market_structure": { "summary": "시장 구조·공백·진입 포인트 (상황·의미·영향)" }
}
5~8개 경쟁사. name, positioning 필수. 새로운 사업 기회 관점으로 weakness 작성. Return ONLY valid JSON. All text in Korean.`

/** Competition prompt using news headlines (for parallel execution with trend) */
export function buildTaskCompetitionPromptFromNews(
  keyword: string,
  newsTitles: string[],
  webContext?: string
): string {
  const newsBlock =
    newsTitles.length > 0
      ? `News headlines:\n${newsTitles.slice(0, 15).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
      : ''
  const webBlock =
    webContext && webContext.trim()
      ? `Web search context (use for grounding):\n${webContext.trim()}\n\n`
      : ''
  return `${webBlock}${newsBlock}Keyword: ${keyword}
PM 사고 순서로 경쟁 분석: 무슨 구조인가, 왜 중요한가, 기회·리스크. 숨은 기회·약한 경쟁자·신규 시장 관점. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

