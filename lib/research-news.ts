/**
 * Shared news fetching for research flows.
 */
import Parser from 'rss-parser'
import { runCleanDataPipe, RSS_SIGNAL_LAYER_FETCH_CAP, SIGNAL_LAYER_TOP_K } from '@/lib/rss/clean-data-pipe'

const RSS_BASE = 'https://news.google.com/rss/search'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type RssItem = { title?: string; link?: string }
const rssParser = new Parser<RssItem>({ customFields: { item: [] } })

export type NewsItem = {
  title: string
  url: string
  publisher?: string
  publishedAt?: string
}

export async function fetchNewsTitles(keyword: string, countryCode = 'KR'): Promise<NewsItem[]> {
  const { getNewsLocale } = await import('@/lib/news-rss-locale')
  const { gl, hl, ceid } = getNewsLocale(countryCode)
  const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=${hl}&gl=${gl}&ceid=${encodeURIComponent(ceid)}`
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, */*' },
  })
  if (!res.ok) return []
  try {
    const xml = await res.text()
    const feed = await rssParser.parseString(xml)
    const items = (feed.items ?? []).slice(0, RSS_SIGNAL_LAYER_FETCH_CAP).map((it) => {
      const title = (it.title ?? '').trim().slice(0, 300)
      const link = typeof it.link === 'string' ? it.link : ''
      let publisher = ''
      try {
        if (link) publisher = new URL(link).hostname.replace(/^www\./, '')
      } catch {
        /* ignore */
      }
      return {
        title,
        url: link,
        publisher: publisher || undefined,
        publishedAt: new Date().toISOString(),
      }
    })
    const withTitle = items.filter((i) => i.title.length > 0)
    return runCleanDataPipe(withTitle, { topK: SIGNAL_LAYER_TOP_K, quiet: true }).items
  } catch {
    return []
  }
}
