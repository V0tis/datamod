/**
 * Two-pass AI generation for performance optimization.
 * Pass 1: summary, temperature, top 3 insights — max 600 tokens, return immediately.
 * Pass 2: detailed insights, actions — run in background.
 */
export const PASS1_SYSTEM = `뉴스 기반 시장 분석. JSON만. 반드시 한국어로만 작성 (Do NOT use Chinese 中文). 결정적 문장. 섹션당 최대 3문장.
출력: { "summary":"한줄요약", "temperature":0-100, "insights":["a","b","c"] }`

export const PASS1_SCHEMA = `{ "summary": string, "temperature": number, "insights": string[] }`

export function buildPass1Prompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` : ''
  return `${block}"${keyword}" 분석. summary(1문장), temperature(0-100), insights(정확히 3개). JSON만. 모든 텍스트는 한국어로만. 중국어 사용 금지.`
}

export const PASS2_SYSTEM = `뉴스 기반 PM 액션. JSON만. 반드시 한국어로만 작성 (Do NOT use Chinese 中文). 결정적 문장.
출력: { "insights":{ "facts":[], "hypotheses":[], "inferences":[] }, "actions":[{ "title":"", "reasoning":"", "urgency":"low|medium|high" }], "signals":{ "pos":[], "neu":[], "neg":[] } }`

export const PASS2_SCHEMA = `{ "insights": { "facts": string[], "hypotheses": string[], "inferences": string[] }, "actions": [{ "title": string, "reasoning": string, "urgency": string }], "signals": { "pos": string[], "neu": string[], "neg": string[] } }`

export function buildPass2Prompt(keyword: string, newsTitles: string[], pass1Summary: string): string {
  const block = newsTitles.length ? `뉴스:\n${newsTitles.slice(0, 12).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n` : ''
  return `${block}1차 요약: ${pass1Summary}\n\n"${keyword}" 상세. facts 3~5, hypotheses 0~3, inferences 2~4. actions 2~4. signals 각 1~3. JSON만. 모든 텍스트는 한국어로만. 중국어 사용 금지.`
}
