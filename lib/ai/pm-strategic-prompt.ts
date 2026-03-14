/**
 * PM Strategic Analysis Prompt
 * Single unified JSON output for decision-making.
 * Avoid fluff, marketing, exaggerated confidence.
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX } from './base-prompt'

export const STRATEGIC_SYSTEM = `${BASE_JSON_PROMPT}

You are a strategic decision engine built for Product Managers.
Structure market signals into actionable strategic judgment.
- Avoid fluff and marketing language.
- Avoid exaggerated confidence.
- Clearly distinguish signals, assumptions, and risks.
- If data is uncertain, state it as hypothesis.`

/** Task 2: Detect trend patterns from news */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

Format: { "market_score": number 0-100, "summary": "2-3 sentences", "positive_signals": ["signal1","signal2"], "neutral_signals": ["signal1"] }`

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
Analyze trend patterns and growth signals from the news and web context above. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Task 3: Analyze competition from trends */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

Format: {
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝 (1문장)",
    "target_market": "타겟 시장 (예: SMB, 엔터프라이즈)",
    "key_feature": "핵심 기능/차별점",
    "pricing": "가격 모델 (예: 무료~$29/월, 프리미엄)",
    "differentiation": "차별화 포인트 (경쟁사 대비 강점)",
    "strength": "강점 (1문장)",
    "weakness": "약점 (1문장)"
  }],
  "market_structure": { "summary": "" }
}
5~8개 경쟁사. name, positioning 필수. 각 필드 가능한 한 구체적으로.`

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

Identify competitors and competitive landscape from the news and web context above. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

