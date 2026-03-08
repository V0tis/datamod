/**
 * Edge-compatible news fetcher. No rss-parser (Node deps).
 * Uses fetch + regex to extract titles from RSS.
 */
import { getNewsLocale } from '@/lib/news-rss-locale'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export type NewsItem = {
  title: string
  url: string
  publisher?: string
  publishedAt?: string
}

function extractText(tag: string, xml: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const text = (m[1] ?? '').replace(/<[^>]+>/g, '').trim()
    if (text) out.push(text)
  }
  return out
}

export async function fetchNewsTitlesEdge(keyword: string, countryCode = 'KR'): Promise<NewsItem[]> {
  const { gl, hl, ceid } = getNewsLocale(countryCode)
  const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  })
  if (!res.ok) return []
  try {
    const xml = await res.text()
    const itemMatch = xml.match(/<item>[\s\S]*?<\/item>/gi)
    if (!itemMatch || itemMatch.length === 0) return []
    const items: NewsItem[] = []
    for (let i = 0; i < Math.min(15, itemMatch.length); i++) {
      const block = itemMatch[i] ?? ''
      const titles = extractText('title', block)
      const links = extractText('link', block)
      const title = (titles[0] ?? '').trim().slice(0, 300)
      const link = (links[0] ?? '').trim()
      if (!title) continue
      let publisher = ''
      try {
        if (link) publisher = new URL(link).hostname.replace(/^www\./, '')
      } catch {
        /* ignore */
      }
      items.push({
        title,
        url: link,
        publisher: publisher || undefined,
        publishedAt: new Date().toISOString(),
      })
    }
    return items
  } catch {
    return []
  }
}
