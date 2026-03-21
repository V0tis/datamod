/**
 * Article content extraction using Mozilla Readability.
 * Fetches HTML from URL, extracts main text, falls back to title on failure.
 */
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const MAX_ARTICLE_CHARS = 3000
const REQUEST_DELAY_MS = 500

const FETCH_HEADERS: HeadersInit = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

function trimContent(text: string, maxChars: number): string {
  const t = (text || '').trim()
  if (t.length <= maxChars) return t
  return t.slice(0, maxChars).trim()
}

async function fetchWithRetry(url: string): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (err) {
      lastErr = err
      if (attempt < 1) await new Promise((r) => setTimeout(r, 1000))
    }
  }
  throw lastErr
}

export type ArticleWithContent = {
  title: string
  url: string
  publisher?: string
  publishedAt?: string
  /** Extracted main text or fallback (title). Trimmed to max chars. */
  content: string
}

/**
 * Fetch article HTML and extract main text using Readability.
 * On failure, falls back to title. Does not throw.
 */
export async function extractArticleContent(
  item: { title: string; url: string; publisher?: string; publishedAt?: string }
): Promise<ArticleWithContent> {
  const fallback: ArticleWithContent = {
    ...item,
    content: trimContent(item.title, MAX_ARTICLE_CHARS),
  }

  if (!item.url || !item.url.startsWith('http')) {
    console.log('[article-extract] skip (no url):', item.title.slice(0, 50))
    return fallback
  }

  try {
    const html = await fetchWithRetry(item.url)
    const dom = new JSDOM(html, { url: item.url })
    const reader = new Readability(dom.window.document) 
    const article = reader.parse()

    console.log('donggun article test check:', article)

    if (!article?.textContent?.trim()) {
      console.log('[article-extract] fallback (no body):', item.title.slice(0, 50), '| contentLen:', 0)
      return fallback
    }

    const content = trimContent(article.textContent, MAX_ARTICLE_CHARS)
    console.log('[article-extract] ok:', item.title.slice(0, 50), '| contentLen:', content.length, '| preview:', content.slice(0, 120) + (content.length > 120 ? '...' : ''))
    return {
      ...item,
      content,
    }
  } catch (err) {
    console.log('[article-extract] fallback (error):', item.title.slice(0, 50), '| err:', err instanceof Error ? err.message : String(err))
    return fallback
  }
}

/**
 * Extract content from multiple articles with delay between requests.
 */
export async function extractArticlesWithDelay(
  items: Array<{ title: string; url: string; publisher?: string; publishedAt?: string }>,
  onProgress?: (index: number, title: string) => void
): Promise<ArticleWithContent[]> {
  const results: ArticleWithContent[] = []
  for (let i = 0; i < items.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
    onProgress?.(i, items[i].title)
    const extracted = await extractArticleContent(items[i])
    results.push(extracted)
  }
  return results
}
