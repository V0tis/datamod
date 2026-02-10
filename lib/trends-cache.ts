import Parser from 'rss-parser'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem, TrendNewsItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = {
  KR: 'KR',
  US: 'US',
  JP: 'JP',
  TW: 'TW',
  HK: 'HK',
  GB: 'GB',
  DE: 'DE',
}

/** 구글 트렌드 RSS (한국 도메인, geo 파라미터) */
const RSS_BASE = 'https://trends.google.co.kr/trending/rss'

const STALE_MINUTES = 60

export type TrendSourceType = 'RSS'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ACCEPT_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  KR: 'ko-KR,ko;q=0.9,en;q=0.8',
  US: 'en-US,en;q=0.9',
  JP: 'ja-JP,ja;q=0.9,en;q=0.8',
  TW: 'zh-TW,zh;q=0.9,en;q=0.8',
  HK: 'zh-HK,zh;q=0.9,en;q=0.8',
  GB: 'en-GB,en;q=0.9',
  DE: 'de-DE,de;q=0.9,en;q=0.8',
}

/** RSS 요청 실패 시 API/클라이언트에서 토스트 등에 노출할 상세 정보 */
export class TrendsFetchError extends Error {
  constructor(
    message: string,
    public readonly countryCode: string,
    public readonly attemptedUrls: string[]
  ) {
    super(message)
    this.name = 'TrendsFetchError'
  }
}

export type { TrendItem }

/** RSS item: title, ht:approx_traffic, ht:news_item_* 등. xml2js는 동일 태그 여러 개 시 배열로 옴. */
type RssParserItem = {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  description?: string
  isoDate?: string
  approxTraffic?: string
  newsItemTitle?: string
  newsItemUrl?: string
  newsItemSource?: string
  newsItemPicture?: string
  /** keepArray: true → 뉴스 여러 개일 때 배열 (xml2js 원소는 string 또는 { _: string }) */
  newsItemTitles?: unknown[]
  newsItemUrls?: unknown[]
  newsItemSources?: unknown[]
  newsItemPictures?: unknown[]
  [key: string]: unknown
}

const parser = new Parser<RssParserItem>({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:news_item_title', 'newsItemTitle'],
      ['ht:news_item_url', 'newsItemUrl'],
      ['ht:news_item_source', 'newsItemSource'],
      ['ht:news_item_picture', 'newsItemPicture'],
      ['ht:news_item_title', 'newsItemTitles', { keepArray: true }],
      ['ht:news_item_url', 'newsItemUrls', { keepArray: true }],
      ['ht:news_item_source', 'newsItemSources', { keepArray: true }],
      ['ht:news_item_picture', 'newsItemPictures', { keepArray: true }],
    ],
  },
})

/** xml2js 원소에서 텍스트 추출 (string 또는 { _: string }) */
function textFromXmlValue(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'object' && v !== null && '_' in v && typeof (v as { _: unknown })._ === 'string') {
    return ((v as { _: string })._).trim()
  }
  return String(v).trim()
}

/** RssParserItem에서 뉴스 아이템 배열 생성 (여러 개 지원, xml2js 텍스트 정규화) */
function collectNewsItems(it: RssParserItem): TrendNewsItem[] {
  const toArr = (v: unknown): unknown[] =>
    Array.isArray(v) ? v : v != null ? [v] : []

  const titles = toArr(it.newsItemTitles ?? it.newsItemTitle)
  const urls = toArr(it.newsItemUrls ?? it.newsItemUrl)
  const sources = toArr(it.newsItemSources ?? it.newsItemSource)
  const images = toArr(it.newsItemPictures ?? it.newsItemPicture)

  const maxLen = Math.max(titles.length, urls.length, 1)
  const result: TrendNewsItem[] = []
  for (let i = 0; i < maxLen; i++) {
    const title = textFromXmlValue(titles[i])
    const url = textFromXmlValue(urls[i])
    if (title || url) {
      result.push({
        title: title || '관련 기사',
        url: url || '#',
        source: textFromXmlValue(sources[i]) || undefined,
        image: textFromXmlValue(images[i]) || undefined,
      })
    }
  }
  return result
}

/** Raw XML에서 <item>...</item> 블록 내 ht:news_item_* 태그 추출 (rss-parser가 네임스페이스로 못 읽을 때 폴백) */
function extractNewsItemsFromItemXml(itemXml: string): TrendNewsItem[] {
  const stripCdata = (s: string) =>
    s.replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/, '$1').trim()

  const tagNames = ['news_item_title', 'news_item_url', 'news_item_source', 'news_item_picture'] as const
  const rePrefix = /(?:ht:)?/
  const arrays: string[][] = [[], [], [], []]

  for (let i = 0; i < tagNames.length; i++) {
    const name = tagNames[i]
    const re = new RegExp(`<${rePrefix.source}${name}[^>]*>([\\s\\S]*?)</(?:ht:)?${name}>`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(itemXml)) !== null) {
      arrays[i].push(stripCdata(m[1].trim()))
    }
  }

  const maxLen = Math.max(arrays[0].length, arrays[1].length, 1)
  const result: TrendNewsItem[] = []
  for (let i = 0; i < maxLen; i++) {
    const title = arrays[0][i] ?? ''
    const url = arrays[1][i] ?? ''
    if (title || url) {
      result.push({
        title: title || '관련 기사',
        url: url || '#',
        source: arrays[2][i] || undefined,
        image: arrays[3][i] || undefined,
      })
    }
  }
  return result
}

/** RSS XML 문자열에서 각 <item> 내부 문자열만 순서대로 추출 */
function getRssItemBlocks(xml: string): string[] {
  const blocks: string[] = []
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

/** description 또는 content에서 검색량 수치 추출 (예: "1,000,000+ searches" / "Approximate number of searches" ) */
function extractSearchVolumeFromText(text: string | undefined): string | null {
  if (!text || typeof text !== 'string') return null
  const match = text.match(/(\d[\d,.]*\+?)\s*(?:searches|searches|회|검색)/i)
  if (match) return match[1].trim()
  const plain = text.match(/(\d[\d,.]*\+?)/)
  return plain ? plain[1].trim() : null
}

/** Google 메뉴/UI 텍스트 등 키워드로 쓰이면 안 되는 문자열 (대소문자 무시) */
const KEYWORD_BLACKLIST = new Set([
  'home', 'explore', 'trending', 'search', 'more', 'all', 'news', 'sports',
  'entertainment', 'default', 'unknown', '—', '–', '-', '',
])

function isBlacklistedKeyword(keyword: string): boolean {
  const k = keyword.trim().toLowerCase()
  return KEYWORD_BLACKLIST.has(k) || k.length < 2
}

/** 국가 코드에 맞는 Accept-Language 값 */
function getAcceptLanguage(countryCode: string): string {
  return ACCEPT_LANGUAGE_BY_COUNTRY[countryCode] ?? 'en-US,en;q=0.9'
}

/** 헤더를 붙여 RSS URL fetch 후 XML 문자열 반환. 404 등이면 throw. */
async function fetchRssXml(url: string, countryCode: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': getAcceptLanguage(countryCode),
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
    },
  })
  if (!res.ok) {
    const err = new Error(`RSS 요청 실패: ${res.status} ${res.statusText}`) as Error & { status?: number; url?: string }
    err.status = res.status
    err.url = url
    throw err
  }
  return res.text()
}

/** RSS URL: https://trends.google.co.kr/trending/rss?geo=${countryCode} */
function getRssUrlForCountry(countryCode: string): string {
  const geo = countryCode.toUpperCase()
  return `${RSS_BASE}?geo=${geo}`
}

const TRANSLATE_TIMEOUT_MS = 25000

/**
 * geo !== 'KR'일 때 키워드만 한국어로 번역해 title_ko 채움. 뉴스 제목은 번역하지 않음.
 * 에러/타임아웃 시 원문 그대로 저장.
 */
async function translateTrendsToKo(items: TrendItem[], countryCode: string): Promise<TrendItem[]> {
  const isKr = countryCode.toUpperCase() === 'KR'
  if (isKr) {
    return items.map((t) => ({
      ...t,
      title_ko: t.keyword,
    }))
  }

  const keywordTexts = items.map((i) => i.keyword).filter(Boolean)

  if (keywordTexts.length === 0) {
    return items.map((t) => ({ ...t, title_ko: t.keyword }))
  }

  let translated: { text: string }[] = []
  try {
    const translate = (await import('google-translate-api-next')).default
    const result = await Promise.race([
      translate(keywordTexts, { to: 'ko', client: 'gtx' as const }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('translate_timeout')), TRANSLATE_TIMEOUT_MS)),
    ])
    translated = Array.isArray(result) ? result : [result]
  } catch (e) {
    translated = keywordTexts.map((text) => ({ text }))
  }

  return items.map((t, i) => {
    const title_ko = translated[i]?.text ?? t.keyword
    return { ...t, title_ko }
  })
}

/** RSS 한 국가 피드를 파싱해 TrendItem[] 반환. 실패 시 TrendsFetchError (attemptedUrls 포함). */
async function fetchTrendsFromRss(countryCode: string): Promise<TrendItem[]> {
  const url = getRssUrlForCountry(countryCode)
  try {
    const xml = await fetchRssXml(url, countryCode)
    const feed = await parser.parseString(xml)
    const itemBlocks = getRssItemBlocks(xml)
    const items: TrendItem[] = []

    for (let i = 0; i < (feed.items?.length ?? 0) && i < 20; i++) {
      const it = feed.items[i] as RssParserItem | undefined
      if (!it) continue

      const keyword = (it.title ?? '').trim().replace(/\s+/g, ' ')
      if (isBlacklistedKeyword(keyword)) continue

      const search_volume =
        (it.approxTraffic && String(it.approxTraffic).trim()) ||
        extractSearchVolumeFromText(it.content ?? it.contentSnippet ?? it.description) ||
        null

      const started_at = it.pubDate?.trim() || it.isoDate?.trim() || null

      let news_items = collectNewsItems(it)
      if (news_items.length === 0 && itemBlocks[i]) {
        news_items = extractNewsItemsFromItemXml(itemBlocks[i])
      }

      items.push({
        keyword,
        rank: items.length + 1,
        search_volume,
        started_at,
        news_items,
      })
    }

    return items
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e))
    throw new TrendsFetchError(err.message, countryCode, [url])
  }
}

/** trend_status 테이블에 출처·갱신 시각 기록 (upsert) */
async function upsertTrendStatus(
  supabase: ReturnType<typeof getSupabase>,
  countryCode: string,
  sourceType: TrendSourceType,
  targetHours: number
): Promise<void> {
  const now = new Date().toISOString()
  await supabase.from('trend_status').upsert(
    {
      country_code: countryCode,
      source_type: sourceType,
      last_updated_at: now,
      target_hours: targetHours,
    },
    { onConflict: 'country_code' }
  )
}

/**
 * RSS 전용 수집. 저장 대상은 DB 테이블 global_trends (RPC upsert_country_trends가 DELETE 후 INSERT).
 * p_rows에 title_ko 포함. trend_status에 출처·갱신 시각 기록.
 */
export async function refreshGlobalTrends(): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[]; TW: TrendItem[]; HK: TrendItem[]; GB: TrendItem[]; DE: TrendItem[] }> {
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [], TW: [], HK: [], GB: [], DE: [] }
  const supabase = getSupabase()

  console.log('[Trends] 수집 시작. RSS 전용')
  for (const [countryCode] of Object.entries(COUNTRY_GEO)) {
    const items = await fetchTrendsFromRss(countryCode)
    const itemsWithKo = await translateTrendsToKo(items, countryCode)
    results[countryCode] = itemsWithKo

    const rowsForRpc = itemsWithKo.map((t) => ({
      keyword: t.keyword,
      rank: t.rank,
      search_volume: t.search_volume,
      started_at: t.started_at,
      news_items: t.news_items ?? [],
      title_ko: t.title_ko ?? null,
      created_at: new Date().toISOString(),
    }))
    const { error: rpcError } = await supabase.rpc('upsert_country_trends', {
      p_country_code: countryCode,
      p_rows: rowsForRpc,
    })
    if (rpcError) {
      console.error('[Trends] upsert_country_trends error:', countryCode, rpcError)
      throw rpcError
    }
    await upsertTrendStatus(supabase, countryCode, 'RSS', 24)
    if (itemsWithKo.length > 0) console.log('Saved:', { country_code: countryCode, count: itemsWithKo.length, source_type: 'RSS' })
  }
  console.log('[Trends] 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length, 'TW:', results.TW.length, 'HK:', results.HK.length, 'GB:', results.GB.length, 'DE:', results.DE.length)
  return {
    KR: results.KR,
    US: results.US,
    JP: results.JP,
    TW: results.TW,
    HK: results.HK,
    GB: results.GB,
    DE: results.DE,
  }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true */
export function isTrendsStale(
  rows: { country_code: string; created_at: string | null }[],
  countryCodes: string[] = ['KR', 'US', 'JP', 'TW', 'HK', 'GB', 'DE']
): boolean {
  const now = Date.now()
  const staleMs = STALE_MINUTES * 60 * 1000
  const byCode = new Map<string, string | null>()
  for (const r of rows) {
    const cur = byCode.get(r.country_code)
    if (!cur || (r.created_at && r.created_at > cur)) byCode.set(r.country_code, r.created_at)
  }
  for (const code of countryCodes) {
    const at = byCode.get(code)
    if (!at) return true
    const t = new Date(at).getTime()
    if (now - t > staleMs) return true
  }
  return false
}
