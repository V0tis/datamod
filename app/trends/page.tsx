'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useRouter, useSearchParams } from 'next/navigation'
import { useResearchStore } from '@/lib/stores/research-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
import { showErrorToast } from '@/lib/error-toast'
import { toast } from 'sonner'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { CountryChips, COUNTRY_CHIP_CODES, COUNTRY_LABELS, type CountryChipCode } from '@/components/country-chips'
import { TrendDetailPanel } from '@/components/trend-detail-panel'

function showTrendsErrorToast(err: unknown): void {
  const e = err as Error & { failedCountryCode?: string; attemptedUrls?: string[] }
  const code = e.failedCountryCode
  const urls = e.attemptedUrls
  if (code != null && Array.isArray(urls) && urls.length > 0) {
    toast.error(e.message ?? '트렌드 수집 실패', {
      description: `실패한 국가: ${code}\n시도한 URL:\n${urls.map((u) => `• ${u}`).join('\n')}`,
      duration: 10000,
    })
    return
  }
  showErrorToast(err, { fallbackMessage: '트렌드를 불러오지 못했어요.' })
}

async function trendsFetcher(url: string, refresh?: boolean): Promise<TrendsResponse> {
  const sep = url.includes('?') ? '&' : '?'
  const target = refresh ? `${url}${sep}refresh=1` : url
  const res = await fetch(target)
  const text = await res.text()
  if (!res.ok) {
    let body: { error?: string; failedCountryCode?: string; attemptedUrls?: string[] } = {}
    try {
      body = JSON.parse(text) as typeof body
    } catch {
      /* ignore */
    }
    const err = new Error(body.error ?? (text || res.statusText)) as Error & {
      status?: number
      failedCountryCode?: string
      attemptedUrls?: string[]
    }
    err.status = res.status
    err.failedCountryCode = body.failedCountryCode
    err.attemptedUrls = body.attemptedUrls
    throw err
  }
  return JSON.parse(text) as TrendsResponse
}

const COUNTRY_CODES = [...COUNTRY_CHIP_CODES] as const
const TRENDS_COUNTRY_STORAGE_KEY = 'trends_selected_country'
const CHIP_LOADING_MS = 280

const SKELETON_ROWS = 8

function TrendsSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
        <div
          key={i}
          className="grid grid-cols-12 gap-3 items-center rounded-xl border border-border bg-muted/20 px-4 py-3 min-h-[52px]"
        >
          <div className="col-span-1 h-4 w-6 rounded bg-muted animate-pulse" />
          <div className="col-span-7 h-4 rounded bg-muted animate-pulse" />
          <div className="col-span-2 h-5 w-14 rounded-full bg-muted animate-pulse" />
          <div className="col-span-2 h-4 w-20 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}

export default function TrendsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const startResearch = useResearchStore((s) => s.startResearch)
  const [country, setCountryState] = useState<CountryChipCode>(() => {
    if (typeof window === 'undefined') return 'KR'
    const saved = window.localStorage.getItem(TRENDS_COUNTRY_STORAGE_KEY)
    return saved && (COUNTRY_CHIP_CODES as readonly string[]).includes(saved)
      ? (saved as CountryChipCode)
      : 'KR'
  })
  const [chipChanging, setChipChanging] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TrendItem | null>(null)

  useEffect(() => {
    const c = searchParams.get('country')
    if (c && (COUNTRY_CHIP_CODES as readonly string[]).includes(c)) {
      setCountryState(c as CountryChipCode)
    }
  }, [searchParams])

  useEffect(() => {
    if (!searchParams.get('country') && typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(TRENDS_COUNTRY_STORAGE_KEY)
      if (saved && (COUNTRY_CHIP_CODES as readonly string[]).includes(saved)) {
        router.replace(`/trends?country=${saved}`)
      }
    }
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(TRENDS_COUNTRY_STORAGE_KEY, country)
    } catch {
      /* ignore */
    }
  }, [country])

  const setCountry = (code: CountryChipCode) => {
    if (code === country) return
    setChipChanging(true)
    setCountryState(code)
    router.replace(`/trends?country=${code}`)
    setTimeout(() => setChipChanging(false), CHIP_LOADING_MS)
  }

  const trendsUrl = '/api/trends'
  const { data, error, isLoading, mutate } = useSWR<TrendsResponse>(trendsUrl, (u: string) => trendsFetcher(u), {
    revalidateOnFocus: false,
  })

  const trends: Record<string, TrendItem[]> = data
    ? {
        KR: normalizeTrendItems(data.KR),
        US: normalizeTrendItems(data.US),
        JP: normalizeTrendItems(data.JP),
        TW: normalizeTrendItems(data.TW),
        HK: normalizeTrendItems(data.HK),
        GB: normalizeTrendItems(data.GB),
        DE: normalizeTrendItems(data.DE),
      }
    : { KR: [], US: [], JP: [], TW: [], HK: [], GB: [], DE: [] }
  const updatedAt = data?.updatedAt ?? null
  const loading = isLoading

  useEffect(() => {
    if (error) showTrendsErrorToast(error)
  }, [error])

  const handleRefresh = () => {
    setUpdating(true)
    trendsFetcher(trendsUrl, true)
      .then((fresh) => {
        mutate(fresh, false)
        toast.success('트렌드 데이터를 성공적으로 갱신했어요.')
      })
      .catch((err) => showTrendsErrorToast(err))
      .finally(() => setUpdating(false))
  }

  const handleRowClick = (item: TrendItem) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const handleAnalyzeFromPanel = (keyword: string) => {
    startResearch(keyword)
    setSelectedItem(null)
    router.push(`/results?keyword=${encodeURIComponent(keyword)}`)
  }

  const items = trends[country] ?? []

  return (
    <div className="p-6 md:p-8 w-full max-w-7xl mx-auto bg-[#F9FAFB] min-h-screen">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          국가별 트렌드
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          DB에 캐시된 국가별 인기 검색어예요. 갱신 버튼으로 최신 트렌드를 불러올 수 있어요. 키워드를 클릭하면 상세 패널이 열려요.
        </p>
      </header>

      <Card className="border border-border bg-white shadow-sm w-full">
        <div className="p-4 border-b border-border space-y-3">
          <CountryChips
            value={country}
            onChange={setCountry}
            updatedAt={updatedAt}
            rightElement={
              <>
                <span
                  className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  title="구글 트렌드 RSS 피드"
                >
                  출처: 구글 트렌드 (RSS)
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={updating}
                  title="새로고침"
                  aria-label="새로고침"
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              </>
            }
          />
        </div>
        <CardHeader>
          <CardTitle className="text-lg">{COUNTRY_LABELS[country] ?? country} 인기 검색어</CardTitle>
          <CardDescription>키워드를 클릭하면 우측 상세 패널이 열려요. 패널에서 &quot;이 키워드로 분석하기&quot;를 누르면 리서치가 시작돼요.</CardDescription>
          <p className="text-amber-700/90 dark:text-amber-300/90 text-xs mt-1">RSS 데이터는 실시간 업데이트 주기를 따릅니다.</p>
        </CardHeader>
        <CardContent className="relative">
          {chipChanging && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-b-lg" aria-hidden>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {loading ? (
            <TrendsSkeleton />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center px-4">
              현재 해당 국가의 데이터를 가져올 수 없습니다. 잠시 후 다시 시도해주세요.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border mb-1">
                <span className="col-span-1">순위</span>
                <span className="col-span-7">키워드</span>
                <span className="col-span-2">검색량</span>
                <span className="col-span-2">등록</span>
              </div>
              <ul className="space-y-2">
                {items.map((item, i) => {
                  const newsPreview = (item.news_items ?? []).slice(0, 2)
                  const previewHeadlines = newsPreview.map((n) => n.title)
                  return (
                    <li key={`${item.keyword}-${i}`} className="rounded-xl border border-border bg-muted/30 overflow-hidden hover:bg-primary/5 hover:border-primary/30 transition-all">
                      <button
                        type="button"
                        onClick={() => handleRowClick(item)}
                        className="w-full text-left grid grid-cols-12 gap-3 items-center px-4 py-3"
                      >
                        <span className="col-span-1 text-muted-foreground text-sm font-medium tabular-nums">
                          {item.rank}
                        </span>
                        <div className="col-span-7 min-w-0">
                          {item.title_ko != null && item.keyword !== item.title_ko ? (
                            <p className="truncate flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-foreground font-semibold text-[15px]">{item.keyword}</span>
                              <span className="text-muted-foreground text-sm">
                                번역: <span className="text-foreground/80">{item.title_ko}</span>
                              </span>
                            </p>
                          ) : (
                            <p className="text-foreground font-semibold truncate">{item.keyword}</p>
                          )}
                        </div>
                        <span className="col-span-2 flex items-center justify-end">
                          {item.search_volume ? (
                            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary tabular-nums">
                              {item.search_volume}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </span>
                        <TimeAgo
                          isoString={item.started_at}
                          className="col-span-2 text-muted-foreground text-xs"
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <TrendDetailPanel
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        selectedItem={selectedItem}
        onAnalyze={handleAnalyzeFromPanel}
      />
    </div>
  )
}
