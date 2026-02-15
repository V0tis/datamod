import { NextResponse } from 'next/server'
import Parser from 'rss-parser'

const RSS_BASE = 'https://news.google.com/rss/search'
const MAX_ITEMS = 10
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

type GoogleNewsItem = {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  [key: string]: unknown
}

const parser = new Parser<GoogleNewsItem>({
  customFields: {
    item: [],
  },
})

/** Google News 설명/콘텐츠에서 언론사명 추출 (예: " ... - 연합뉴스" 또는 마지막 구절) */
function extractSource(description: string | undefined, title: string | undefined): string {
  if (!description && !title) return '언론사'
  const text = (description ?? title ?? '').trim()
  const dashMatch = text.match(/\s*[-–—]\s*([^\s\-–—]+(?:\s+[^\s\-–—]+)*)\s*$/)
  if (dashMatch) return dashMatch[1].trim().slice(0, 80)
  return '언론사'
}

const DEFAULT_DAYS = 30
const MIN_DAYS = 1
const MAX_DAYS = 365

/** GET: keyword 쿼리로 구글 뉴스 RSS 조회. days(기본 30)일 이내 기사만 반환, 최신순 (AI 호출 없음) */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const keyword = searchParams.get('keyword')?.trim()
  if (!keyword) {
    return NextResponse.json({ error: 'keyword required', items: [] }, { status: 400 })
  }

  const daysParam = searchParams.get('days')
  const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, daysParam ? parseInt(daysParam, 10) : DEFAULT_DAYS))
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000

  try {
    const url = `${RSS_BASE}?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    })
    if (!res.ok) {
      console.error('[News API] RSS fetch failed:', res.status, res.statusText)
      return NextResponse.json(
        { error: '뉴스를 불러오지 못했습니다.', items: [] },
        { status: 502 }
      )
    }
    const xml = await res.text()
    const feed = await parser.parseString(xml)
    const raw = (feed.items ?? [])
      .slice(0, MAX_ITEMS * 4)
      .map((it) => {
        const title = (it.title ?? '').trim()
        const link = typeof it.link === 'string' ? it.link : ''
        const pubDate = (it.pubDate ?? it.isoDate ?? '').trim()
        const source = extractSource(it.contentSnippet ?? it.content ?? '', it.title)
        return { title, link, pubDate, source }
      })
      .filter((i) => i.title.length > 0)

    // 발행일 기준 최신순 (pubDate 내림차순), 선택한 기간(days) 이내만
    const sorted = raw
      .filter((i) => {
        if (!i.pubDate) return true
        const t = new Date(i.pubDate).getTime()
        return !Number.isNaN(t) && t >= cutoffMs
      })
      .sort((a, b) => {
        const tA = a.pubDate ? new Date(a.pubDate).getTime() : 0
        const tB = b.pubDate ? new Date(b.pubDate).getTime() : 0
        return tB - tA
      })
    const items = sorted.slice(0, MAX_ITEMS)

    return NextResponse.json({ items })
  } catch (e) {
    console.error('[News API]', e)
    return NextResponse.json(
      { error: '뉴스를 불러오지 못했습니다.', items: [] },
      { status: 500 }
    )
  }
}
