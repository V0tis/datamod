/**
 * Web search grounding for research pipeline.
 * Flow: user query → web search → extract top sources → feed to LLM.
 * Uses Serper API (https://serper.dev). Set SERPER_API_KEY in env for web grounding.
 */

export type WebSearchResult = {
  title: string
  link: string
  snippet: string
}

export type WebSearchOptions = {
  /** Max number of results to return (default 10) */
  num?: number
}

const SERPER_ENDPOINT = 'https://google.serper.dev/search'

/**
 * Run web search for the given query and return top sources.
 * Returns empty array if SERPER_API_KEY is not set (graceful fallback).
 */
export async function searchWeb(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  const apiKey = (process.env.SERPER_API_KEY ?? '').trim()
  if (!apiKey) {
    return []
  }

  const num = Math.min(Math.max(options.num ?? 10, 1), 20)
  const body = JSON.stringify({ q: query.trim(), num })

  try {
  const res = await fetch(SERPER_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.warn('[Web Search] Serper API error', { status: res.status, body: text.slice(0, 200) })
    return []
  }

  const data = (await res.json().catch(() => ({}))) as {
    organic?: Array<{ title?: string; link?: string; snippet?: string }>
  }
  const organic = data?.organic ?? []
  const results: WebSearchResult[] = organic
    .filter((r) => r?.title && r?.link)
    .slice(0, num)
    .map((r) => ({
      title: String(r.title ?? ''),
      link: String(r.link ?? ''),
      snippet: String(r.snippet ?? ''),
    }))
  return results
  } catch (e) {
    console.warn('[Web Search]', e)
    return []
  }
}

/**
 * Format top sources as a single context string for LLM prompts.
 */
export function formatWebContext(results: WebSearchResult[], maxItems = 10): string {
  if (results.length === 0) return ''
  const items = results.slice(0, maxItems)
  return items
    .map(
      (r, i) =>
        `${i + 1}. ${r.title}\n   URL: ${r.link}\n   ${r.snippet ? r.snippet : '(no snippet)'}`
    )
    .join('\n\n')
}
