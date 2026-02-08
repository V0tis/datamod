import * as cheerio from 'cheerio'
import { getSupabase } from '@/lib/supabase'
import type { TrendItem } from '@/lib/trends-types'

const COUNTRY_GEO: Record<string, string> = { KR: 'KR', US: 'US', JP: 'JP' }
const TRENDS_URL = 'https://trends.google.com/trending'
const STALE_MINUTES = 60
const WAIT_FOR_MS = 5000

/** DB 저장 시 제외할 메뉴/노이즈 키워드 (대소문자 무시) */
const NOISE_KEYWORDS = new Set([
  'home',
  'explore',
  'trending now',
  'trends',
  '트렌딩',
  '홈',
  '탐색',
  'search',
  '검색',
  'more',
  '더보기',
  'menu',
  '메뉴',
  'settings',
  '설정',
  'sign in',
  '로그인',
  'daily search trends',
  '실시간 검색 트렌드',
])

export type { TrendItem }

function isNoiseKeyword(keyword: string): boolean {
  if (!keyword || typeof keyword !== 'string') return true
  const k = keyword.trim().toLowerCase()
  if (k.length < 2) return true
  return NOISE_KEYWORDS.has(k)
}

/** search_volume이 비어 있으면 스킵하고 에러 로그 */
function filterAndValidateItems(items: TrendItem[], countryCode: string): TrendItem[] {
  const valid: TrendItem[] = []
  for (const item of items) {
    if (isNoiseKeyword(item.keyword)) {
      console.log('[Trends] 스킵(노이즈 키워드):', item.keyword)
      continue
    }
    if (!item.search_volume || String(item.search_volume).trim() === '') {
      console.error('[Trends] search_volume 없음, DB 저장 스킵. keyword:', item.keyword, 'country:', countryCode)
      continue
    }
    valid.push(item)
  }
  return valid.map((t, i) => ({ ...t, rank: i + 1 }))
}

/** HTML에서 셀렉터 기반으로 트렌드 아이템 추출 (.title, .item-title, .sub-title, 시간·연관키워드) */
function extractTrendItemsFromHtml(html: string): TrendItem[] {
  if (!html || typeof html !== 'string') return []
  const $ = cheerio.load(html)
  const items: TrendItem[] = []
  const seen = new Set<string>()

  // 리스트 아이템 컨테이너 후보: 트렌드 한 행을 감싸는 요소
  const containerSelectors = [
    '[class*="feed-item"]',
    '[class*="trend-item"]',
    '[class*="list-item"]',
    'article',
    'li[class*="item"]',
    'div[class*="row"][class*="trend"]',
    '.detail-list-item',
  ]

  let rows: cheerio.Cheerio<cheerio.Element> = $([])
  for (const sel of containerSelectors) {
    rows = $(sel)
    if (rows.length >= 3) break
  }

  if (rows.length === 0) {
    // 컨테이너 없으면 .title / .item-title 단위로 수집 (순서로 매칭)
    const titles = $('.title, .item-title').toArray()
    const subTitles = $('.sub-title').toArray()
    const volumeRe = /[\d,.]+\s*(?:만|K|M|k|m)?\+?/
    for (let i = 0; i < titles.length && items.length < 10; i++) {
      const keyword = $(titles[i]).text().trim().replace(/\s+/g, ' ')
      if (!keyword || seen.has(keyword)) continue
      seen.add(keyword)
      let search_volume: string | null = null
      const subEl = subTitles[i]
      if (subEl) {
        const subText = $(subEl).text()
        const m = subText.match(volumeRe)
        if (m) search_volume = m[0].trim()
      }
      items.push({
        keyword,
        rank: items.length + 1,
        search_volume,
        started_at: null,
        analysis_keywords: [],
      })
    }
    return items
  }

  const timeRe = /(\d+\s*(?:시간|일|분|주)\s*전|hours?|days?|minutes?\s*ago)/i
  for (let i = 0; i < rows.length && items.length < 10; i++) {
    const row = rows.eq(i)
    const keywordEl = row.find('.title, .item-title').first()
    const keyword = keywordEl.text().trim().replace(/\s+/g, ' ')
    if (!keyword || seen.has(keyword)) continue
    seen.add(keyword)

    let search_volume: string | null = null
    const subEl = row.find('.sub-title').first()
    if (subEl.length) {
      const subText = subEl.text()
      const m = subText.match(/[\d,.]+\s*(?:만|K|M|k|m)?\+?/)
      if (m) search_volume = m[0].trim()
    }
    if (!search_volume && subEl.length) {
      const t = subEl.text().trim()
      if (/^\d+/.test(t)) search_volume = t.split(/\s/)[0] ?? null
    }

    let started_at: string | null = null
    const rowText = row.text()
    const timeMatch = rowText.match(timeRe)
    if (timeMatch) started_at = timeMatch[1].trim()
    row.find('time').each((_: number, el: cheerio.Element) => {
      const t = $(el).text().trim() || $(el).attr('datetime')
      if (t) started_at = started_at || t
    })

    const analysis_keywords: string[] = []
    row.find('[class*="related"], [class*="keyword"] a, .tag, [class*="tag"]').each((_: number, el: cheerio.Element) => {
      const t = $(el).text().trim()
      if (t && t.length >= 2 && t.length <= 50) analysis_keywords.push(t)
    })

    items.push({
      keyword,
      rank: items.length + 1,
      search_volume,
      started_at,
      analysis_keywords: analysis_keywords.slice(0, 10),
    })
  }
  return items
}

/** 마크다운에서 트렌드명·검색량·시작시점·분석키워드 추출 (휴리스틱, HTML 추출 실패 시 폴백) */
function extractTrendItemsFromMarkdown(markdown: string): TrendItem[] {
  if (!markdown || typeof markdown !== 'string') return []
  const lines = markdown.split(/\n/).map((l) => l.trim()).filter(Boolean)
  const items: TrendItem[] = []
  const seen = new Set<string>()

  const volumeRe = /(\d+[\d,.]*(?:만|K|M|k|m)?\+?)\s*(?:검색|search|회)/i
  const startedRe = /(\d+\s*(?:시간|일|분|주)\s*전|hours?|days? ago)/i
  const keywordLabelRe = /(?:관련|분석|키워드|related|keywords?)\s*[:\-]\s*(.+)/i

  for (let i = 0; i < lines.length && items.length < 10; i++) {
    const raw = lines[i]
    const line = raw.replace(/^#+\s*/, '').replace(/\s*\[.*?\]\(.*?\)\s*/g, '').trim()
    if (line.length < 2 || line.length > 80 || /^https?:\/\//i.test(line) || /^[\d.]+\s*$/.test(line)) continue
    const key = line.slice(0, 100)
    if (seen.has(key)) continue
    seen.add(key)

    let search_volume: string | null = null
    let started_at: string | null = null
    let analysis_keywords: string[] = []

    const volMatch = line.match(volumeRe) || (lines[i + 1] && lines[i + 1].match(volumeRe))
    if (volMatch) search_volume = volMatch[1].trim()
    const startMatch = line.match(startedRe) || (lines[i + 1] && lines[i + 1].match(startedRe))
    if (startMatch) started_at = startMatch[1].trim()
    const kwMatch = line.match(keywordLabelRe) || (lines[i + 1] && lines[i + 1].match(keywordLabelRe))
    if (kwMatch) {
      analysis_keywords = kwMatch[1]
        .split(/[,··]/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 1 && s.length <= 50)
        .slice(0, 10)
    }

    items.push({
      keyword: line,
      rank: items.length + 1,
      search_volume,
      started_at,
      analysis_keywords,
    })
  }
  return items
}

/** Firecrawl으로 국가별 트렌드 크롤링 후 global_trends에 저장 (셀렉터·필터·검증 적용) */
export async function refreshGlobalTrends(): Promise<{ KR: TrendItem[]; US: TrendItem[]; JP: TrendItem[] }> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY?.trim()
  const results: Record<string, TrendItem[]> = { KR: [], US: [], JP: [] }
  const supabase = getSupabase()

  console.log('[Trends] Google 트렌드 페이지에서 데이터 수집 시작. URL:', TRENDS_URL, 'waitFor:', WAIT_FOR_MS, 'ms')
  for (const [countryCode, geo] of Object.entries(COUNTRY_GEO)) {
    try {
      const url = `${TRENDS_URL}?geo=${geo}`
      console.log('[Trends] 요청 URL:', url, '(countryCode:', countryCode, ')')
      const res = await fetch('https://api.firecrawl.dev/v0/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firecrawlKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html'],
          onlyMainContent: true,
          timeout: 30000,
          wait_for: WAIT_FOR_MS,
        }),
      })

      const contentType = res.headers.get('content-type') ?? ''
      const rawText = await res.text()
      if (!res.ok || !contentType.includes('application/json')) {
        const errMsg = rawText || res.statusText || `HTTP ${res.status}`
        console.warn('[Trends] Firecrawl 응답 실패 (HTML 또는 에러):', url, 'status:', res.status, 'content-type:', contentType, 'body:', rawText.slice(0, 500))
        throw new Error(errMsg)
      }
      let json: { success?: boolean; data?: { markdown?: string; html?: string }; error?: string }
      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error(rawText || 'Firecrawl 응답 JSON 파싱 실패')
      }
      const data = json?.data ?? {}
      const html = data.html ?? ''
      const markdown = data.markdown ?? ''

      let items: TrendItem[]
      if (html && html.length > 500) {
        items = extractTrendItemsFromHtml(html)
        console.log('[Trends] HTML 셀렉터 추출:', countryCode, '→', items.length, '개')
      } else {
        items = extractTrendItemsFromMarkdown(markdown)
        console.log('[Trends] Markdown 휴리스틱 추출:', countryCode, '→', items.length, '개')
      }

      items = filterAndValidateItems(items, countryCode)
      results[countryCode] = items

      if (items.length > 0) {
        console.dir(
          items.map((t) => ({ keyword: t.keyword, search_volume: t.search_volume, started_at: t.started_at })),
          { depth: 3 }
        )
      }

      await supabase.from('global_trends').delete().eq('country_code', countryCode)
      if (items.length > 0) {
        const rowsToInsert = items.map((t) => ({
          country_code: countryCode,
          keyword: t.keyword,
          rank: t.rank,
          search_volume: t.search_volume,
          started_at: t.started_at,
          analysis_keywords: t.analysis_keywords,
          created_at: new Date().toISOString(),
        }))
        const { error: insertError } = await supabase.from('global_trends').insert(rowsToInsert)
        if (insertError) {
          console.error('[Trends] global_trends insert error:', countryCode, insertError)
          throw insertError
        }
        console.log('Saved Data:', { country_code: countryCode, rows: rowsToInsert, count: rowsToInsert.length })
      }
    } catch (e) {
      console.warn('[Trends] 수집 실패:', countryCode, `${TRENDS_URL}?geo=${geo}`, e)
      throw e
    }
  }
  console.log('[Trends] Google 트렌드 수집 종료. KR:', results.KR.length, 'US:', results.US.length, 'JP:', results.JP.length)
  return { KR: results.KR, US: results.US, JP: results.JP }
}

/** 데이터가 비었거나 STALE_MINUTES보다 오래됐으면 true (확장 스키마: country별 최신 created_at 기준) */
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
