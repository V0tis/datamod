/**
 * Web search grounding for research pipeline.
 * Flow: user query → web search → extract top sources → feed to LLM.
 * Uses Serper API (https://serper.dev). 키는 호출 시 전달(apiKey) — 서버 env 폴백 없음.
 */

export type WebSearchResult = {
  title: string
  link: string
  snippet: string
}

export type WebSearchOptions = {
  /** Max number of results to return (default 10) */
  num?: number
  /** Serper API key (필수). 설정 페이지에 저장된 키를 전달 */
  apiKey?: string
}

const SERPER_ENDPOINT = 'https://google.serper.dev/search'

/**
 * Run web search for the given query and return top sources.
 * apiKey가 없으면 검색하지 않고 빈 배열 반환.
 */
export async function searchWeb(
  query: string,
  options: WebSearchOptions = {}
): Promise<WebSearchResult[]> {
  const apiKey = (options.apiKey ?? '').trim()
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
