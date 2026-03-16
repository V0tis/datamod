/**
 * Two-pass AI generation for performance optimization.
 * Pass 1: summary, temperature, top 3 insights — max 600 tokens, return immediately.
 * Pass 2: detailed insights, actions — run in background.
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX } from './base-prompt'

export const PASS1_SYSTEM = `${BASE_JSON_PROMPT}

뉴스 기반 시장 분석. 컨설팅 보고서 수준. 인사이트·근거 포함. 단순 요약 금지.
출력: { "summary": "한줄 요약 (인사이트·영향 포함)", "temperature": 0-100, "insights": ["인사이트1", "인사이트2", "인사이트3"] }
summary와 insights는 비즈니스 의미·이유 포함. JSON만.`

export const PASS1_SCHEMA = `{ "summary": string, "temperature": number, "insights": string[] }`

export function buildPass1Prompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` : ''
  return `${block}"${keyword}" 분석. summary(1문장, 인사이트 중심), temperature(0-100), insights(정확히 3개, 근거·영향 포함). JSON만. ${KOREAN_ONLY_SUFFIX}`
}

export const PASS2_SYSTEM = `${BASE_JSON_PROMPT}

뉴스 기반 PM 액션. 각 action에 reasoning(근거)·영향 필수. 단순 나열 금지.
출력: { "insights": { "facts": [], "hypotheses": [], "inferences": [] }, "actions": [{ "title": "", "reasoning": "근거·영향", "urgency": "low|medium|high" }], "signals": { "pos": [], "neu": [], "neg": [] } }
facts/hypotheses/inferences는 검증 가능한 사실·가정·해석 구분. actions는 실행 가능하고 이유 명시. JSON만.`

export const PASS2_SCHEMA = `{ "insights": { "facts": string[], "hypotheses": string[], "inferences": string[] }, "actions": [{ "title": string, "reasoning": string, "urgency": string }], "signals": { "pos": string[], "neu": string[], "neg": string[] } }`

export function buildPass2Prompt(keyword: string, newsTitles: string[], pass1Summary: string): string {
  const block = newsTitles.length ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` : ''
  return `${block}1차 요약: ${pass1Summary}\n\n"${keyword}" 상세. facts 3~5, hypotheses 0~3, inferences 2~4. actions 2~4(각 reasoning 필수). signals 각 1~3. JSON만. ${KOREAN_ONLY_SUFFIX}`
}
