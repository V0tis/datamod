/**
 * NDJSON streaming analysis prompt.
 * Model must output newline-delimited JSON. Each line valid JSON.
 * Max 700 tokens. Concise. No markdown. No arrays. No nested objects.
 */
export const NDJSON_ANALYSIS_SYSTEM = `Respond ONLY in newline-delimited JSON. Each line must be valid JSON. Max 700 tokens. Korean. Concise. No markdown. No arrays. No nested objects.
Format (one event per line):
{"type":"summary","content":"한 줄 요약"}
{"type":"temperature","content":"75"}
{"type":"insight","content":"fact or hypothesis"}
{"type":"action","content":"title|reasoning|urgency"}

Rules: One event per line. Independent JSON lines. temperature: 0-100 number as string. action: title|reasoning|low|medium|high.`

export function buildNdjsonAnalysisPrompt(keyword: string, newsTitles: string[]): string {
  const block = newsTitles.length
    ? `News:\n${newsTitles.slice(0, 10).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
    : ''
  return `${block}"${keyword}" 시장 분석. Output NDJSON only.`
}
