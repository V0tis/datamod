import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX } from '@/lib/ai/base-prompt'
import type { InsightSuggestionRequestBody } from '@/lib/types/insight-suggestion'

export const INSIGHT_SUGGESTION_JSON_FORMAT = `{
  "opportunity_score": number,
  "risk_score": number,
  "risk_grade": "string",
  "attractiveness_grade": "string",
  "focus_market_keyword": "string",
  "rationale_one_liner": "string",
  "competition_overview": "string",
  "market_issue": "string",
  "recommended_action": "string"
}`

export const INSIGHT_SUGGESTION_SYSTEM = `${BASE_JSON_PROMPT}

역할: PM을 위한 **실시간** 인사이트 제안 엔진. 입력은 **이번 분석 런**에서만 수집된 데이터(키워드 리서치, 경쟁 테이블, 뉴스)뿐이다. 과거 DB·다른 키워드 누적 가정을 하지 않는다.

반드시 아래 순서로 사고한 뒤 JSON만 출력한다.
1) [경쟁 구도 확인]: 주요 경쟁자가 누구이며 어떤 가치를 제공하는지 한 덩어리로 요약한다.
2) [시장 문제 정의]: 경쟁사 분석·뉴스를 대조해 유저 불만·기능적 공백을 **구체적 Issue**로 쓴다(추상적 표현 금지).
3) [실행 방안 도출]: 그 문제를 풀고 우위를 가질 **구체적 기능 또는 비즈니스 전략**을 제안한다.

출력 필드:
- opportunity_score, risk_score: 각각 0~100 정수. 시장 매력도·진입 장벽(경쟁·실행 난이도 반영).
- risk_grade, attractiveness_grade: 한국어 짧은 등급 라벨(예: 중간, 높음).
- focus_market_keyword: 이번 분석에서 전략적 가치가 가장 높다고 보는 키워드(보통 입력 keyword와 동일해도 됨).
- rationale_one_liner: 반드시 **한 문장**으로, 아래 꼴을 따른다.
  "이 시장은 [경쟁자/플랫폼 이름]가 [구체적 미해결 문제]를 해결하지 못하고 있어, 우리가 [구체적 기능/전략]으로 진입할 때 성공 가능성이 높다."
- competition_overview, market_issue, recommended_action: 각 1~3문장, 한국어, DATA 근거.

Format: ${INSIGHT_SUGGESTION_JSON_FORMAT}

Return ONLY valid JSON.`

export function buildInsightSuggestionUserPayload(body: InsightSuggestionRequestBody): string {
  const newsBlock =
    body.news_items?.length ?
      body.news_items
        .slice(0, 20)
        .map((n, i) => `${i + 1}. ${n.title ?? ''}${n.publisher ? ` (${n.publisher})` : ''}`)
        .join('\n')
    : ''
  const lines = body.market_news_lines?.length ? body.market_news_lines.slice(0, 12).join('\n') : ''
  const neg = body.negative_signals?.length ? body.negative_signals.slice(0, 8).join('\n') : ''
  const gs = body.growth_signals?.length ? body.growth_signals.slice(0, 8).join('\n') : ''
  let landscapeJson = '[]'
  try {
    landscapeJson = JSON.stringify(body.competitive_landscape ?? [], null, 0)
  } catch {
    landscapeJson = '[]'
  }
  const sg = body.strategic_gaps
  const sgText = sg
    ? [
        sg.summary && `요약: ${sg.summary}`,
        sg.functional?.length && `기능 공백: ${sg.functional.join(' / ')}`,
        sg.pricing?.length && `가격 공백: ${sg.pricing.join(' / ')}`,
      ]
        .filter(Boolean)
        .join('\n')
    : ''

  return `KEYWORD: ${body.keyword}
COUNTRY: ${body.country_code ?? 'KR'}

[Trend / research summary]
${body.trend_summary?.trim() || '(없음)'}

[Growth signals]
${gs || '(없음)'}

[Competitive landscape JSON]
${landscapeJson}

[Market structure]
${body.market_structure?.trim() || '(없음)'}

[Strategic gaps]
${sgText || '(없음)'}

[News headlines]
${newsBlock || '(없음)'}

[Market news lines]
${lines || '(없음)'}

[Negative / risk signals]
${neg || '(없음)'}

TASK: 위 DATA만으로 INSIGHT_SUGGESTION_SYSTEM 규칙에 맞는 JSON 한 객체를 출력한다. ${KOREAN_ONLY_SUFFIX}`
}
