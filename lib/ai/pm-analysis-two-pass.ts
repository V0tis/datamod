/**
 * Two-pass AI generation – PM decision support.
 * Pass 1: situation·meaning·impact. Pass 2: opportunity·risk·strategy·action.
 */
import { BASE_JSON_PROMPT, KOREAN_ONLY_SUFFIX, PM_THINKING_ORDER, PM_STRUCTURED_RULE } from './base-prompt'

export const PASS1_SYSTEM = `${BASE_JSON_PROMPT}

PM 의사결정 지원. ${PM_THINKING_ORDER} 중 1) 무슨 일이 일어나는가 2) 왜 중요한가 3) 시장 영향에 해당하는 내용을 summary·insights에 담으세요.
컨설팅 보고서 수준. 한국 PM이 읽는 문서처럼. 단순 요약 금지.
출력: { "summary": "한줄 (상황·의미·영향)", "temperature": 0-100, "insights": ["인사이트1", "인사이트2", "인사이트3"] }
JSON만.`

export const PASS1_SCHEMA = `{ "summary": string, "temperature": number, "insights": string[] }`

export function buildPass1Prompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` : ''
  return `${block}"${keyword}" 분석. PM 사고: 상황·의미·영향. summary(1문장), temperature(0-100), insights(3개, 비즈니스 의미 포함). JSON만. ${KOREAN_ONLY_SUFFIX}`
}

export const PASS2_SYSTEM = `${BASE_JSON_PROMPT}

PM 의사결정 지원. ${PM_STRUCTURED_RULE} 기회·리스크·전략·액션을 facts/hypotheses/inferences와 actions에 반영하세요.
각 action: reasoning(근거)·영향 필수. 단순 나열 금지.
출력: { "insights": { "facts": [], "hypotheses": [], "inferences": [] }, "actions": [{ "title": "", "reasoning": "근거·영향", "urgency": "low|medium|high" }], "signals": { "pos": [], "neu": [], "neg": [] } }
JSON만.`

export const PASS2_SCHEMA = `{ "insights": { "facts": string[], "hypotheses": string[], "inferences": string[] }, "actions": [{ "title": string, "reasoning": string, "urgency": string }], "signals": { "pos": string[], "neu": string[], "neg": string[] } }`

export function buildPass2Prompt(keyword: string, newsTitles: string[], pass1Summary: string): string {
  const block = newsTitles.length ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` : ''
  return `${block}1차 요약: ${pass1Summary}\n\n"${keyword}" 상세. PM 사고 순서 반영: facts 3~5, hypotheses 0~3, inferences 2~4, actions 2~4(각 reasoning·영향 필수), signals 각 1~3. JSON만. ${KOREAN_ONLY_SUFFIX}`
}
