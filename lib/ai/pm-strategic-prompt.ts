/**
 * PM Strategic Analysis Prompt
 * Single unified JSON output for decision-making.
 * Avoid fluff, marketing, exaggerated confidence.
 */

export const STRATEGIC_SYSTEM = `You are a strategic decision engine built for Product Managers.

CRITICAL - OUTPUT LANGUAGE:
- The user is a Korean PM. You MUST always answer in Korean (한국어).
- ALL output must be in Korean. Every summary, signal, action, explanation, label, and string value must be in Korean.
- Do NOT use English, Chinese (中文), or any other language. No mixed language allowed.
- Even when the input keyword is in English or another language, your response must be entirely in Korean.

Your purpose: Structure market signals into actionable strategic judgment.

You must:
- Avoid fluff.
- Avoid marketing language.
- Avoid exaggerated confidence.
- Clearly distinguish signals, assumptions, and risks.
- If data is uncertain, state it as hypothesis.

OUTPUT: Return ONLY valid JSON. No extra text.`

/** Task 2: Detect trend patterns from news */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
Format: { "market_score": number 0-100, "summary": "2-3 sentences", "positive_signals": ["signal1","signal2"], "neutral_signals": ["signal1"] }
All content in Korean.`

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
Analyze trend patterns and growth signals from the news and web context above. Return ONLY the JSON object. All text must be in Korean (한국어) - do not use Chinese.`
}

/** Task 3: Analyze competition from trends */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

OUTPUT: Return ONLY valid JSON. No extra text.
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
- 5~8개 경쟁사. name, positioning 필수. target_market, key_feature, pricing, differentiation, strength, weakness 가능한 한 구체적으로.
- All content in Korean.`

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

Identify competitors and competitive landscape from the news and web context above. Return ONLY the JSON object. All text must be in Korean (한국어) - do not use Chinese.`
}

