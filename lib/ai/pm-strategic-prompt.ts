/**
 * PM Strategic Analysis Prompt
 * Single unified JSON output for decision-making.
 * Avoid fluff, marketing, exaggerated confidence.
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX } from './base-prompt'

export const STRATEGIC_SYSTEM = `${BASE_JSON_PROMPT}

You are a strategic decision engine for Product Managers.
- Generate insights and reasoning, not just summaries. Explain why, impact, risk, opportunity.
- Use business and strategy language. Output must feel like a consulting report or PM analysis.
- Avoid fluff, marketing language, casual or news-summary tone.
- Clearly distinguish signals, assumptions, and risks. If uncertain, state as hypothesis.`

/** Task 2: Trend analysis – market temperature, signals, and PM-ready insight */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

Output must include: summary (시장 방향성·트렌드 요약), market_score (0-100), positive_signals (성장·기회 시그널, 각 항목에 비즈니스 의미 포함), neutral_signals (관찰만).
Include brief reasoning for score and why each signal matters for PM decisions.
Format: { "market_score": number 0-100, "summary": "2-3문장 (인사이트·근거 포함)", "positive_signals": ["시그널과 비즈니스 의미"], "neutral_signals": ["중립 관찰"] }
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
Identify trend direction, growth signals, and hidden opportunities or risks. Provide summary with reasoning and business impact. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

/** Task 3: Competition analysis – landscape, gaps, competitor weaknesses */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

Identify competitors, market gaps, and competitor weaknesses. Each entry must support PM strategy (positioning, strength, weakness for opportunity).
Format: {
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝 (1문장)",
    "target_market": "타겟 시장",
    "key_feature": "핵심 기능/차별점",
    "pricing": "가격 모델",
    "differentiation": "차별화 포인트",
    "strength": "강점 (1문장)",
    "weakness": "약점 (1문장, 기회 포착용)"
  }],
  "market_structure": { "summary": "시장 구조·공백·진입 포인트 요약" }
}
5~8개 경쟁사. name, positioning 필수. weakness는 PM이 활용할 수 있는 기회 관점으로 구체적 작성. All text in Korean. Return ONLY valid JSON.`

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
Identify competitors, market structure, and competitor weaknesses (opportunity angle). Provide business meaning and strategy implications. Return ONLY the JSON object. ${KOREAN_ONLY_SUFFIX}`
}

