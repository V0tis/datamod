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
- market_score(0~100)는 DATA 속 시그널 강도와 방향을 반영해 산정한다. 평가 시 5점 척도(아주 약함~아주 강함)로 미세 구간을 나눠 생각한 뒤 0~100으로 환산한다. 유망한 신호(성장·수요·규제 완화·투자·파트너십 등)가 DATA에 분명히 보이면 보수적으로만 깎지 말고 적극적으로 높은 구간(예: 65~90)을 부여한다.
- DATA가 비어 있으면 최소 JSON과 빈 배열로 응답한다.

PM 순서: 무슨 일 → 왜 중요 → 시장 영향 → 기회 → 리스크가 summary·시그널에 녹아 있게.
Format: { "market_score": number 0-100, "summary": "2~3문장 (상황·의미·영향)", "positive_signals": ["시그널과 비즈니스 의미"], "neutral_signals": ["중립 관찰"] }
Return ONLY valid JSON. 본문은 한국어.`

export type ArticleForAnalysis = { title: string; summary: string; publisher?: string }

const TASK_TRENDS_USER_TASK = `위 search results·collected data만으로 시장 트렌드를 JSON으로 정리한다. summary·positive_signals·neutral_signals·market_score(0~100)는 모두 인용 가능한 DATA 조각과 연결되게 쓴다. market_score는 5점 척도로 근거 축을 세분화한 뒤 환산하고, 긍정적·유망한 DATA가 있으면 과도하게 낮게 매기지 말고 높은 점수를 허용한다. PM 순서 situation→meaning→impact→opportunity→risk가 한 흐름으로 읽히게.`
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

/** Task 3: Competition analysis – DATA-DRIVEN ONLY, 비즈니스 전략·로드맵 근거 중심. */
export const TASK_COMPETITION_SYSTEM = `${STRATEGIC_SYSTEM}

사용자 메시지는 KEYWORD / COLLECTED_DATA / TASK / RULES 형식이다.

경쟁 분석: DATA 텍스트에 회사·플랫폼·서비스 이름이 문자 그대로 등장한 경우에만 competitive_landscape에 넣는다.
- 각 항목은 DATA 안에서 확인 가능한 문장·수치와 연결된다.
- DATA에 경쟁 주체가 없으면 competitive_landscape는 []로 두고, market_structure.summary·strategic_gaps·pm_planning_summary·strategic_action_plan은 DATA 범위 안에서만 최소한으로 채운다.
- 언론사·매거진·블로그·뉴스 미디어 브랜드는 경쟁사 후보에서 제외한다(보도 주체로만 등장한 경우).

【Strategic Gap】 strategic_gaps: 시장·집단 차원의 기능·가격 공백(공통 요약). 행별 competitor_gap과 중복되면 안 된다(공통은 여기만).
【정량 좌표】 각 경쟁사마다 market_presence(시장 점유·존재감 1~10), growth_score(성장성·모멘텀 1~10)를 산출하고, score_rationale에 "왜 이 점수인지" DATA 근거 2~3문장을 쓴다(버블 차트·로드맵 설득력).
【차별화 — 반드시 경쟁사별 1:1】 competitive_landscape의 **각 원소마다** competitor_gap·our_differentiation·differentiation은 **그 행의 name에만 해당**하는 문장이어야 한다.
- competitor_gap: "집단·시장 전체"가 아니라 **해당 경쟁사 제품/서비스**에서 부족하거나 유저가 불만을 가질 만한 **구체적 지점** 1문장(가능하면 해당 이름을 문장에 포함). 다른 행과 동일 문장·복붙 금지.
- our_differentiation: KEYWORD(우리 제품)가 **위에서 짚은 그 경쟁사의 공백**을 어떻게 메우는지 **구체적**으로 1문장. 모든 행에 같은 문장을 반복하지 말 것.
- differentiation: 선택. 있으면 해당 행 전용 한 줄 요약(다른 행과 동일하면 안 됨). 범용 마케팅 허구(예: "니즈 충족", "차별화된 경험 제공")만 있는 문장은 쓰지 말 것.
【PM 근거】 pm_planning_summary: 이 JSON이 로드맵·OKR 수립에 왜 쓰이는지 PM 관점 2~4문장.
【실행】 strategic_action_plan: roadmap_priorities(차기 제품 우선순위 3~5, rationale에 strategic_gaps·경쟁 공백 연결), okr_key_results(O 목표 후보 + 측정 가능한 KR 문장들).

weakness: DATA에 드러난 한계를 "실험으로 검증 가능한 공략" 문장으로.

Format (필드명·중괄호 유지): {
  "competitive_landscape": [{
    "name": "경쟁사명",
    "positioning": "포지셔닝 (1문장)",
    "target_market": "타겟 시장",
    "key_feature": "핵심 기능·제품 (DATA 기반)",
    "pricing": "가격·과금 구조 요약",
    "market_presence": number,
    "growth_score": number,
    "score_rationale": "시장 점유·성장성 점수 산정 근거 (DATA, 2~3문장)",
    "competitor_gap": "이 name 경쟁사에만 해당하는 구체적 약점·불만 포인트 (DATA 근거)",
    "our_differentiation": "KEYWORD 제품이 그 경쟁사 공백에 대응하는 구체적 대응 전략 (행마다 다르게)",
    "differentiation": "선택: 이 행 전용 한 줄(다른 행과 중복 금지)",
    "strength": "강점 (1문장)",
    "weakness": "DATA 근거 공략·실험 가설"
  }],
  "market_structure": { "summary": "시장 구조·진입 포인트 (상황·의미·영향)" },
  "strategic_gaps": {
    "functional_gaps": ["기능적 공백 불릿"],
    "pricing_gaps": ["가격·과금 공백 불릿"],
    "summary": "Strategic Gap 한 단락 요약"
  },
  "pm_planning_summary": "로드맵·OKR에 바로 쓰는 기획 근거 요약",
  "strategic_action_plan": {
    "roadmap_priorities": [{ "priority_rank": number, "title": "제품·기능 우선순위", "rationale": "경쟁 구도·공백과의 연결" }],
    "okr_key_results": [{ "objective": "목표 테마", "key_results": ["측정 가능한 KR", "..."] }]
  }
}
- market_presence·growth_score: 1~10 정수. 차트 X=시장 점유, Y=성장성.
- 5~8개까지. name, positioning, target_market, key_feature, pricing, market_presence, growth_score, score_rationale, competitor_gap, our_differentiation 필수(데이터로 채울 수 없으면 해당 항목은 DATA 한계를 한 문장으로 명시).
Return ONLY valid JSON. 본문은 한국어.`

const TASK_COMPETITION_USER_TASK = `위 DATA만으로 경쟁 JSON을 채운다. competitive_landscape에는 텍스트에 실제로 이름이 나온 회사·플랫폼만 넣는다. 없으면 [].
각 행 i의 competitor_gap·our_differentiation·differentiation은 **반드시 그 행 name(i)에만** 대한 분석이어야 한다(다른 경쟁사 행과 문장을 복사·공유하지 말 것). 시장 전체 공통 서술은 strategic_gaps에만 둔다.
DIFFERENTIATION 열에 들어갈 문장은 행마다 날카로운 인사이트로 다르게 쓰고, "이용자 니즈 충족" 등 모든 기업에 쓰이는 무의미한 상투구는 쓰지 않는다.
strategic_gaps·pm_planning_summary·strategic_action_plan까지 포함해 비즈니스 전략 산출물로 완성한다.`

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
