/**
 * PM Strategic Analysis Prompt – PM decision support, not chatbot.
 * Follow PM thinking: situation → meaning → impact → opportunity → risk → strategy → action.
 */
import {
  BASE_JSON_PROMPT,
  KOREAN_ONLY_SUFFIX,
  PM_THINKING_ORDER,
  PM_STRUCTURED_RULE,
  INNOVATION_INSTRUCTION,
  buildDataDrivenPrompt,
} from './base-prompt'

export const STRATEGIC_SYSTEM = `${BASE_JSON_PROMPT}

PM 의사결정 지원용 분석 엔진입니다. 챗봇이 아닙니다.
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- ${INNOVATION_INSTRUCTION}
- 상황·의미·영향·기회·리스크·전략·액션을 구체적으로 제시하세요. 단순 요약 금지.`

/** Task 2: Trend analysis – PM thinking order, market temperature, opportunity/risk. DATA-DRIVEN ONLY. */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

사용자 메시지는 INPUT / DATA / TASK / RULES 형식이다. DATA에 있는 내용만 근거로 한다. RULES를 반드시 준수한다.

트렌드 분석: 반드시 DATA의 search results·collected data만 사용. 추측·발명·할루시네이션 금지.

필수 규칙:
1. summary, positive_signals, neutral_signals는 모두 DATA에서 직접 추출·요약한 내용만 포함.
2. market_score(0-100)는 DATA의 시그널·근거로만 산정. DATA가 비면 빈 배열·최소 JSON.
3. DATA에 없는 시그널·숫자·사실을 만들지 마세요.

PM 사고 순서: 무슨 일이 일어나는지 → 왜 중요한지 → 시장 영향 → 기회 → 리스크.
Format: { "market_score": number 0-100, "summary": "2-3문장 (상황·의미·영향 포함)", "positive_signals": ["시그널과 기회/비즈니스 의미"], "neutral_signals": ["중립 관찰"] }
Return ONLY valid JSON. All text in Korean.`

export type ArticleForAnalysis = { title: string; summary: string; publisher?: string }

export function buildTaskTrendsPrompt(
  keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string
): string {
  const collectedData =
    articles.length > 0
      ? articles
          .map(
            (a, i) =>
              `${i + 1}. title: ${a.title}\n   summary: ${a.summary}${a.publisher ? `\n   publisher: ${a.publisher}` : ''}`
          )
          .join('\n\n')
      : ''
  return buildDataDrivenPrompt({
    keyword,
    sections: {
      searchResults: webContext?.trim() || undefined,
      collectedData: collectedData || undefined,
    },
    task: `Analyze market trends using ONLY the DATA above (search results + collected data). Derive summary, positive_signals, neutral_signals, and market_score (0-100) only from DATA. PM 사고 순서: situation → meaning → impact → opportunity → risk.`,
    suffix: `Return ONLY one JSON object. ${KOREAN_ONLY_SUFFIX}`,
  })
}

/** Task 3: Competition analysis – DATA-DRIVEN ONLY. No invention, no guessing. */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

사용자 메시지는 INPUT / DATA / TASK / RULES 형식이다. DATA에 있는 내용만 근거로 한다. RULES를 반드시 준수한다.

경쟁 분석: 반드시 DATA의 search results·collected data만 사용. 추측·발명·할루시네이션 금지.

필수 규칙 (위반 시 잘못된 출력):
1. competitive_landscape에는 오직 아래 데이터에 명시적으로 등장하는 회사/플랫폼만 포함.
2. 각 경쟁사는 반드시 데이터의 특정 문장에서 확인 가능해야 함. 없으면 넣지 마세요.
3. 데이터에 경쟁사가 없으면 competitive_landscape: [] 반환. 빈 배열이 정답.
4. 추측·암시·일반적인 웹사이트·알고 있는 회사 나열 금지. 제공된 텍스트에 없는 이름 금지.
5. 제외: 언론사·매거진·블로그·뉴스미디어 (Vogue, TechCrunch, Forbes 등).

Format: {
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝 (1문장)",
    "target_market": "타겟 시장",
    "market_presence": number,
    "innovation_level": number,
    "differentiation": "차별화 포인트",
    "strength": "강점 (1문장)",
    "weakness": "약점 (PM이 파고들 수 있는 진입 포인트)"
  }],
  "market_structure": { "summary": "시장 구조·공백·진입 포인트 (상황·의미·영향)" }
}
- market_presence: 정수 1-10. DATA에 근거한 시장 점유·브랜드 인지도·노출 강도의 상대 평가(UI 시각화용).
- innovation_level: 정수 1-10. DATA에 근거한 기술·제품·비즈니스 모델 혁신성의 상대 평가(UI 시각화용).
- 수치는 반드시 DATA의 사실·비교 언급을 바탕으로 산정. 근거가 매우 약하면 보수적으로 4-6 범위를 사용하고, 그 이유는 strength/weakness 문장에 녹인다.
5~8개 경쟁사. name, positioning, market_presence, innovation_level 필수. 새로운 사업 기회 관점으로 weakness 작성. Return ONLY valid JSON. All text in Korean.`

/** Competition prompt using articles (for parallel execution with trend) */
export function buildTaskCompetitionPromptFromNews(
  keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string,
  competitorWebContext?: string
): string {
  const searchParts: string[] = []
  if (competitorWebContext?.trim()) {
    searchParts.push(`[competitor-focused search]\n${competitorWebContext.trim()}`)
  }
  if (webContext?.trim()) {
    searchParts.push(`[general web search]\n${webContext.trim()}`)
  }
  const searchResults = searchParts.join('\n\n')
  const collectedData =
    articles.length > 0
      ? articles
          .map(
            (a, i) =>
              `${i + 1}. title: ${a.title}\n   summary: ${a.summary}${a.publisher ? `\n   publisher: ${a.publisher}` : ''}`
          )
          .join('\n\n')
      : ''
  return buildDataDrivenPrompt({
    keyword,
    sections: {
      searchResults: searchResults || undefined,
      collectedData: collectedData || undefined,
    },
    task: `Analyze competitive landscape using ONLY the DATA above. List companies/platforms only if explicitly named in DATA. If none, competitive_landscape: []. For each competitor include market_presence and innovation_level as integers 1-10 grounded in DATA (for dashboard charts). market_structure.summary must reflect DATA only. Exclude publishers/media as competitors.`,
    suffix: `If DATA does not name competitors for "${keyword}", return competitive_landscape: []. Return ONLY JSON. ${KOREAN_ONLY_SUFFIX}`,
  })
}

