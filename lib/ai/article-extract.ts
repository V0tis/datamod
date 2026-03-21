/**
 * Article content extraction using Mozilla Readability.
 * Fetches HTML from URL, extracts main text, falls back to title on failure.
 * Google News RSS URLs are decoded to actual article URLs before fetch.
 */
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const MAX_ARTICLE_CHARS = 3000
const REQUEST_DELAY_MS = 500
const GOOGLE_NEWS_PREFIX = 'https://news.google.com/rss/articles/'

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

/**
 * Decode Google News RSS redirect URL to actual article URL.
 * Returns original URL if not a Google News article link or decode fails.
 */
function resolveArticleUrl(url: string): string {
  if (!url.startsWith(GOOGLE_NEWS_PREFIX)) return url
  try {
    const u = new URL(url)
    const pathParts = u.pathname.split('/')
    const base64Part = pathParts[pathParts.length - 1]?.split('?')[0]
    if (!base64Part || !/^[A-Za-z0-9_-]+$/.test(base64Part)) return url
    const padded = base64Part + '==='.slice(0, (4 - (base64Part.length % 4)) % 4)
    const decoded = Buffer.from(padded, 'base64url')
    const binary = decoded.toString('binary')
    const httpIdx = binary.indexOf('http')
    if (httpIdx < 0) return url
    const endMarker = String.fromCharCode(0xd2)
    const endIdx = binary.indexOf(endMarker, httpIdx)
    const extracted = endIdx > 0 ? binary.slice(httpIdx, endIdx) : binary.slice(httpIdx)
    const candidate = extracted.replace(/\0/g, '').trim()
    if (candidate.startsWith('http') && candidate.length < 2048) return candidate
  } catch {
    /* ignore */
  }
  return url
}

async function fetchWithRetry(url: string): Promise<{ html: string; finalUrl: string }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(15000),
        redirect: 'follow',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const html = await res.text()
      const finalUrl = res.url || url
      return { html, finalUrl }
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
    const resolvedUrl = resolveArticleUrl(item.url)
    const { html, finalUrl } = await fetchWithRetry(resolvedUrl)
    const dom = new JSDOM(html, { url: finalUrl })
    const doc = dom.window.document

    let text = ''
    const parsed = new Readability(doc).parse()
    if (parsed?.textContent?.trim()) {
      text = parsed.textContent
    } else {
      const fallbackSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.article-body',
        '.post-content',
        '.entry-content',
        '.article-content',
        '#article-body',
        '.content',
        '#content',
      ]
      for (const sel of fallbackSelectors) {
        const el = doc.querySelector(sel)
        if (el?.textContent?.trim()) {
          text = el.textContent
          break
        }
      }
      if (!text && doc.body?.textContent?.trim()) {
        text = doc.body.textContent
      }
    }

    if (!text.trim()) {
      console.log('[article-extract] fallback (no body):', item.title.slice(0, 50))
      return fallback
    }

    const content = trimContent(text, MAX_ARTICLE_CHARS)
    console.log('[article-extract] ok:', item.title.slice(0, 50), '| contentLen:', content.length)
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
