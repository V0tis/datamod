import Parser from 'rss-parser'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }

/** 웹 우선: 구글 트렌드 트렌딩 페이지 (hours 적용) */
const WEB_TRENDING_BASE = 'https://trends.google.co.kr/trending'

/** RSS 폴백: 구글 트렌드 RSS (geo만, hours 미지원) */
const RSS_BASE = 'https://trends.google.com/trending/rss'

const STALE_MINUTES = 60

export type TrendSourceType = 'WEB' | 'RSS'

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ACCEPT_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  KR: 'ko-KR,ko;q=0.9,en;q=0.8',
  US: 'en-US,en;q=0.9',
  JP: 'ja-JP,ja;q=0.9,en;q=0.8',
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

/** RSS item에 맞춘 커스텀 필드 (ht:approx_traffic 등) */
type RssParserItem = {
  title?: string
  link?: string
  pubDate?: string
  content?: string
  contentSnippet?: string
  isoDate?: string
  approxTraffic?: string
  [key: string]: unknown
}

const parser = new Parser<RssParserItem>({
  customFields: {
    item: [
      ['ht:approx_traffic', 'approxTraffic'],
      ['ht:news_item', 'newsItem'],
    ],
  },
})

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

/** description/content에서 연관 키워드·문구 추출 (쉼표·줄바꿈 구분, 태그 제거) */
function extractAnalysisKeywords(text: string | undefined): string[] {
  if (!text || typeof text !== 'string') return []
  const stripped = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped
    .split(/[,;|·\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 50 && !KEYWORD_BLACKLIST.has(s.toLowerCase()))
    .slice(0, 10)
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

const DEFAULT_HOURS = 24

/** 웹 트렌딩 페이지 URL (geo, hours 적용) */
function getWebTrendingUrl(countryCode: string, hours: number = DEFAULT_HOURS): string {
  return `${WEB_TRENDING_BASE}?geo=${countryCode}&hours=${hours}`
}

/** RSS 시도 URL 목록 (폴백용, geo만) */
function getRssUrlsForCountry(countryCode: string): string[] {
  const upper = countryCode.toUpperCase()
  const lower = countryCode.toLowerCase()
  return [
    `${RSS_BASE}?geo=${upper}`,
    `${RSS_BASE}?ed=${lower}`,
  ]
}

/** 웹 페이지에서 트렌드 목록 추출 시도. 실패 또는 비어 있으면 null 반환. */
async function fetchTrendsFromWeb(countryCode: string, hours: number = DEFAULT_HOURS): Promise<TrendItem[] | null> {
  const url = getWebTrendingUrl(countryCode, hours)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': getAcceptLanguage(countryCode),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const items: TrendItem[] = []
    const arrayLike = html.match(/\[[\s\S]*?"(?:title|query|keyword|name)"\s*:\s*"[^"]+"[\s\S]*?\]/g)
    if (arrayLike) {
      for (const block of arrayLike) {
        try {
          const parsed = JSON.parse(block) as Array<{ title?: string; query?: string; keyword?: string; name?: string; formattedTraffic?: string; approxTraffic?: string }>
          if (Array.isArray(parsed) && parsed.length >= 3) {
            parsed.forEach((o, i) => {
              const keyword = (o.title ?? o.query ?? o.keyword ?? o.name ?? '').trim().replace(/\s+/g, ' ')
              if (keyword.length >= 2 && !isBlacklistedKeyword(keyword)) {
                const raw = o.formattedTraffic ?? o.approxTraffic
                items.push({
                  keyword,
                  rank: items.length + 1,
                  search_volume: raw != null ? String(raw) : null,
                  started_at: null,
                  analysis_keywords: [],
                })
              }
            })
            if (items.length > 0) return items
          }
        } catch {
          /* ignore */
        }
      }
    }
    const windowData = html.match(/window\.(?:__INITIAL|__STATE|__DATA)\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/m)
    if (windowData) {
      try {
        const data = JSON.parse(windowData[1]) as Record<string, unknown>
        const list = (data.trendingList ?? data.dailyTrends ?? data.trends ?? data.list) as Array<Record<string, unknown>> | undefined
        if (Array.isArray(list) && list.length >= 3) {
          list.forEach((o) => {
            const keyword = String(o.title ?? o.query ?? o.keyword ?? o.name ?? '').trim().replace(/\s+/g, ' ')
            if (keyword.length >= 2 && !isBlacklistedKeyword(keyword)) {
              items.push({
                keyword,
                rank: items.length + 1,
                search_volume: o.formattedTraffic ?? o.approxTraffic != null ? String(o.approxTraffic) : null,
                started_at: null,
                analysis_keywords: [],
              })
            }
          })
          if (items.length > 0) return items
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* timeout or network */
  }
  return null
}

/** RSS 한 국가 피드를 파싱해 TrendItem[] 반환. 실패 시 TrendsFetchError (attemptedUrls 포함). */
async function fetchTrendsFromRss(countryCode: string): Promise<TrendItem[]> {
  const urls = getRssUrlsForCountry(countryCode)
  let lastError: Error | null = null

  for (const url of urls) {
    try {
      const xml = await fetchRssXml(url, countryCode)
      const feed = await parser.parseString(xml)
      const items: TrendItem[] = []

      for (let i = 0; i < (feed.items?.length ?? 0) && i < 20; i++) {
        const it = feed.items[i] as RssParserItem | undefined
        if (!it) continue

        const keyword = (it.title ?? '').trim().replace(/\s+/g, ' ')
        if (isBlacklistedKeyword(keyword)) continue

        const search_volume =
          (it.approxTraffic && String(it.approxTraffic).trim()) ||
          extractSearchVolumeFromText(it.content ?? it.contentSnippet) ||
          null

        const started_at = it.pubDate?.trim() || it.isoDate?.trim() || null

        const description = it.content ?? it.contentSnippet ?? ''
        const analysis_keywords = extractAnalysisKeywords(description)

        items.push({
          keyword,
          rank: items.length + 1,
          search_volume,
          started_at,
          analysis_keywords,
        })
      }

      return items
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const status = (lastError as Error & { status?: number }).status
      if (status === 404 || status === 403) {
        continue
      }
      throw new TrendsFetchError(lastError.message, countryCode, urls)
    }
  }

  throw new TrendsFetchError(
    lastError?.message ?? 'RSS 요청 실패',
    countryCode,
    urls
  )
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
 * 웹 우선 수집 후 실패 시 RSS 폴백. 동일 국가 기존 데이터는 upsert_country_trends 내부에서 DELETE 후 INSERT.
 * trend_status에 출처(WEB/RSS) 및 target_hours 기록.
 */
export async function refreshGlobalTrends(hours: number = DEFAULT_HOURS): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[] }> {
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  const supabase = getSupabase()

  console.log('[Trends] 수집 시작. 웹 우선, hours=', hours)
  for (const [countryCode] of Object.entries(COUNTRY_GEO)) {
    const webUrl = getWebTrendingUrl(countryCode, hours)
    let items: TrendItem[]
    let sourceType: TrendSourceType

    try {
      const webItems = await fetchTrendsFromWeb(countryCode, hours)
      if (webItems && webItems.length > 0) {
        items = webItems
        sourceType = 'WEB'
        console.log('[Trends] 웹 수집 완료:', countryCode, '→', items.length, '개')
      } else {
        items = await fetchTrendsFromRss(countryCode)
        sourceType = 'RSS'
        console.log('[Trends] RSS 폴백 완료:', countryCode, '→', items.length, '개')
      }
    } catch (e) {
      try {
        items = await fetchTrendsFromRss(countryCode)
        sourceType = 'RSS'
        console.log('[Trends] 웹 실패 후 RSS 폴백:', countryCode, '→', items.length, '개')
      } catch (rssErr) {
        if (e instanceof TrendsFetchError) throw e
        throw new TrendsFetchError(
          e instanceof Error ? e.message : String(e),
          countryCode,
          [webUrl, ...getRssUrlsForCountry(countryCode)]
        )
      }
    }

    results[countryCode] = items

    const rowsForRpc = items.map((t) => ({
      keyword: t.keyword,
      rank: t.rank,
      search_volume: t.search_volume,
      started_at: t.started_at,
      analysis_keywords: t.analysis_keywords,
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
    await upsertTrendStatus(supabase, countryCode, sourceType, hours)
    if (items.length > 0) console.log('Saved:', { country_code: countryCode, count: items.length, source_type: sourceType })
  }
  console.log('[Trends] 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length)
  return { KR: results.KR, US: results.US, JP: results.JP }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true */
export function isTrendsStale(
  rows: { country_code: string; created_at: string | null }[],
  countryCodes: string[] = ['KR', 'US', 'JP']
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
