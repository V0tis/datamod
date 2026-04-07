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
  type DataDrivenSections,
} from './base-prompt'

export const STRATEGIC_SYSTEM = `${BASE_JSON_PROMPT}

역할: PM 의사결정 지원 분석 엔진(채팅 UI 아님).
- ${PM_THINKING_ORDER}
- ${PM_STRUCTURED_RULE}
- ${INNOVATION_INSTRUCTION}
- 상황·의미·영향·기회·리스크·전략·액션을 DATA에 기대어 구체 문장으로 제시한다.`

/** Task 2: Trend analysis – PM thinking order, market temperature, opportunity/risk. DATA-DRIVEN ONLY. */
export const TASK_TRENDS_SYSTEM = `${STRATEGIC_SYSTEM}

사용자 메시지는 KEYWORD / COLLECTED_DATA / TASK / RULES 형식이다. 답은 DATA에 기대어 쓴 JSON 한 덩어리.

트렌드: search results·collected data에 등장한 관찰·수치·인용만으로 summary·시그널·점수를 만든다.
- summary, positive_signals, neutral_signals는 DATA에서 직접 보이는 내용의 압축과 해석이다.
- market_score(0~100)는 DATA 속 시그널 강도와 방향을 반영해 산정한다.
- DATA가 비어 있으면 최소 JSON과 빈 배열로 응답한다.

PM 순서: 무슨 일 → 왜 중요 → 시장 영향 → 기회 → 리스크가 summary·시그널에 녹아 있게.
Format: { "market_score": number 0-100, "summary": "2~3문장 (상황·의미·영향)", "positive_signals": ["시그널과 비즈니스 의미"], "neutral_signals": ["중립 관찰"] }
Return ONLY valid JSON. 본문은 한국어.`

export type ArticleForAnalysis = { title: string; summary: string; publisher?: string }

const TASK_TRENDS_USER_TASK = `위 search results·collected data만으로 시장 트렌드를 JSON으로 정리한다. summary·positive_signals·neutral_signals·market_score(0~100)는 모두 인용 가능한 DATA 조각과 연결되게 쓴다. PM 순서 situation→meaning→impact→opportunity→risk가 한 흐름으로 읽히게.`
const TASK_TRENDS_SUFFIX = `응답은 JSON 객체 하나만. ${KOREAN_ONLY_SUFFIX}`

export function buildTaskTrendsSections(
  _keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string
): DataDrivenSections {
  const collectedData =
    articles.length > 0
      ? articles
          .map(
            (a, i) =>
              `${i + 1}. title: ${a.title}\n   summary: ${a.summary}${a.publisher ? `\n   publisher: ${a.publisher}` : ''}`
          )
          .join('\n\n')
      : ''
  return {
    searchResults: webContext?.trim() || undefined,
    collectedData: collectedData || undefined,
  }
}

export function buildTaskTrendsPromptParts(
  keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string
): { prompt: string; sections: DataDrivenSections } {
  const sections = buildTaskTrendsSections(keyword, articles, webContext)
  const prompt = buildDataDrivenPrompt({
    keyword,
    sections,
    task: TASK_TRENDS_USER_TASK,
    suffix: TASK_TRENDS_SUFFIX,
  })
  return { prompt, sections }
}

export function buildTaskTrendsPrompt(
  keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string
): string {
  return buildTaskTrendsPromptParts(keyword, articles, webContext).prompt
}

/** Task 3: Competition analysis – DATA-DRIVEN ONLY. */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

사용자 메시지는 KEYWORD / COLLECTED_DATA / TASK / RULES 형식이다.

경쟁 분석: DATA 텍스트에 회사·플랫폼·서비스 이름이 문자 그대로 등장한 경우에만 competitive_landscape에 넣는다.
- 각 항목은 DATA 안에서 확인 가능한 문장·수치와 연결된다.
- DATA에 경쟁 주체가 없으면 competitive_landscape는 []로 두고, market_structure.summary만 DATA로 채운다.
- 언론사·매거진·블로그·뉴스 미디어 브랜드는 경쟁사 후보에서 제외한다(보도 주체로만 등장한 경우).

weakness 필드: DATA에 드러난 제품 한계·가격 민감·지연·CS 이슈·규제 언급 등을 "새 진입자가 파고들 수 있는 실행 가설" 문장으로 쓴다. "차별화하라" 같은 원론 한 줄로 끝내지 않는다.

Format: {
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝 (1문장)",
    "target_market": "타겟 시장",
    "market_presence": number,
    "innovation_level": number,
    "differentiation": "차별화 포인트",
    "strength": "강점 (1문장)",
    "weakness": "DATA 근거 진입·공략 포인트 (PM이 실험으로 옮길 수 있게)"
  }],
  "market_structure": { "summary": "시장 구조·공백·진입 포인트 (상황·의미·영향)" }
}
- market_presence·innovation_level: 1~10 정수. DATA의 사실·비교 언급을 반영한 상대 평가(UI용). 근거가 약하면 4~6대로 보수적으로 두고 strength·weakness 문장에 근거를 녹인다.
- 5~8개까지. name, positioning, market_presence, innovation_level 필수.
Return ONLY valid JSON. 본문은 한국어.`

const TASK_COMPETITION_USER_TASK = `위 DATA만으로 경쟁 JSON을 채운다. competitive_landscape에는 텍스트에 실제로 이름이 나온 회사·플랫폼만 넣는다. 없으면 []. 각 competitor의 weakness는 DATA에 나온 사실(지연·가격·기능 공백·불만·규제 등)을 짚어, 우리가 시도할 수 있는 구체 공략·실험 가설로 문장화한다. market_presence·innovation_level은 1~10으로 차트용 산정. market_structure.summary는 DATA에 기반한 구조·틈만.`

export function buildTaskCompetitionSections(
  _keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string,
  competitorWebContext?: string
): DataDrivenSections {
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
  return {
    searchResults: searchResults || undefined,
    collectedData: collectedData || undefined,
  }
}

export function buildTaskCompetitionPromptParts(
  keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string,
  competitorWebContext?: string
): { prompt: string; sections: DataDrivenSections } {
  const sections = buildTaskCompetitionSections(keyword, articles, webContext, competitorWebContext)
  const prompt = buildDataDrivenPrompt({
    keyword,
    sections,
    task: TASK_COMPETITION_USER_TASK,
    suffix: `DATA에 "${keyword}" 관련 명시적 경쟁 주체가 없으면 competitive_landscape: []. JSON만. ${KOREAN_ONLY_SUFFIX}`,
  })
  return { prompt, sections }
}

/** Competition prompt using articles (for parallel execution with trend) */
export function buildTaskCompetitionPromptFromNews(
  keyword: string,
  articles: ArticleForAnalysis[],
  webContext?: string,
  competitorWebContext?: string
): string {
  return buildTaskCompetitionPromptParts(keyword, articles, webContext, competitorWebContext).prompt
}
