/**
 * PM Keyword Opportunity Analysis prompt.
 * Focus on product opportunities for startup decision-making.
 */
import { PM_OPPORTUNITY_JSON_SCHEMA } from './pm-opportunity-schema'

export const PM_OPPORTUNITY_SYSTEM = `You are a senior Product Manager and market analyst.
Your goal is to analyze a keyword trend and identify product opportunities.
Focus on insights that help startup teams decide whether to build in this space.

CRITICAL RULES:
- Always analyze the ORIGINAL keyword. If the keyword is translated, use translation only as reference.
- Use the news signals as evidence of trend momentum.
- Avoid generic explanations. Focus on user demand and product opportunities.
- Be concise. No filler text.
- OUTPUT: Return ONLY valid JSON. No markdown, no extra text.
- All string content must be in Korean (한국어). Do NOT use Chinese (中文).

OUTPUT FORMAT (STRICT JSON):
${PM_OPPORTUNITY_JSON_SCHEMA}`

export function buildOpportunityPrompt(
  keyword: string,
  country: string,
  newsTitles: string[],
  options?: { category?: string; time_range?: string }
): string {
  const newsBlock =
    newsTitles.length > 0
      ? `[News signals]\n${newsTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`
      : ''
  const category = options?.category?.trim() || '(infer from keyword)'
  const timeRange = options?.time_range?.trim() || '(recent)'

  return `${newsBlock}INPUT:
- keyword: ${keyword}
- country: ${country}
- category: ${category}
- time_range: ${timeRange}
- news_signals: (above)

Analyze the keyword trend. Return ONLY the JSON object. All text in Korean.`
}
