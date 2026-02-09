'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { useRouter } from 'next/navigation'
import { Drawer } from 'vaul'
import { useResearchStore } from '@/lib/stores/research-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, RefreshCw, Loader2, BarChart3, Newspaper, Tag, X } from 'lucide-react'
import { cn, formatTimeAgo } from '@/lib/utils'
import { showErrorToast } from '@/lib/error-toast'
import { toast } from 'sonner'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { Badge } from '@/components/ui/badge'

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

const COUNTRY_LABELS: Record<string, string> = {
  KR: '한국',
  US: '미국',
  JP: '일본',
}

const COUNTRY_CODES = ['KR', 'US', 'JP'] as const

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
          <div className="col-span-3 h-4 rounded bg-muted animate-pulse" />
          <div className="col-span-2 h-5 w-14 rounded-full bg-muted animate-pulse" />
          <div className="col-span-2 h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="col-span-4 flex gap-1.5">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-5 w-16 rounded-full bg-muted animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TrendsPage() {
  const router = useRouter()
  const startResearch = useResearchStore((s) => s.startResearch)
  const [country, setCountry] = useState<'KR' | 'US' | 'JP'>('KR')
  const [trendHours, setTrendHours] = useState<24 | 4>(24)
  const [updating, setUpdating] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<TrendItem | null>(null)

  const trendsUrl = `/api/trends?hours=${trendHours}`
  const { data, error, isLoading, mutate } = useSWR<TrendsResponse>(trendsUrl, (u: string) => trendsFetcher(u), {
    revalidateOnFocus: false,
  })

  const trends: Record<string, TrendItem[]> = data
    ? {
        KR: normalizeTrendItems(data.KR),
        US: normalizeTrendItems(data.US),
        JP: normalizeTrendItems(data.JP),
      }
    : { KR: [], US: [], JP: [] }
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
      })
      .catch((err) => showTrendsErrorToast(err))
      .finally(() => setUpdating(false))
  }

  const handleRowClick = (item: TrendItem) => {
    setSelectedItem(item)
    setDrawerOpen(true)
  }

  const handleAnalyzeFromDrawer = () => {
    if (!selectedItem) return
    startResearch(selectedItem.keyword)
    setDrawerOpen(false)
    setSelectedItem(null)
    router.push(`/results?keyword=${encodeURIComponent(selectedItem.keyword)}`)
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
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2 flex-wrap items-center">
            {COUNTRY_CODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCountry(code)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  country === code
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                )}
              >
                {COUNTRY_LABELS[code] ?? code} ({code})
              </button>
            ))}
            <span className="text-muted-foreground text-xs mx-1">|</span>
            <div className="flex rounded-lg overflow-hidden border border-border">
              <button
                type="button"
                onClick={() => setTrendHours(24)}
                disabled={updating}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  trendHours === 24
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                24시간
              </button>
              <button
                type="button"
                onClick={() => setTrendHours(4)}
                disabled={updating}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  trendHours === 4
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                4시간
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              마지막 업데이트: {updatedAt ? formatTimeAgo(updatedAt) : '—'}
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
          </div>
        </div>
        <CardHeader>
          <CardTitle className="text-lg">{COUNTRY_LABELS[country] ?? country} 인기 검색어</CardTitle>
          <CardDescription>키워드를 클릭하면 우측 상세 패널이 열려요. 패널에서 &quot;이 키워드로 분석하기&quot;를 누르면 리서치가 시작돼요.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TrendsSkeleton />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              아직 캐시된 트렌드가 없어요. &quot;트렌드 갱신&quot;을 눌러 주세요.
            </p>
          ) : (
            <>
              {/* 테이블 헤더: 순위 | 키워드 | 검색량 | n시간 전 | 분석 키워드 */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border mb-1">
                <span className="col-span-1">순위</span>
                <span className="col-span-4">키워드</span>
                <span className="col-span-2">검색량</span>
                <span className="col-span-2">등록</span>
                <span className="col-span-3">연관 키워드</span>
              </div>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={`${item.keyword}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleRowClick(item)}
                      className="w-full text-left grid grid-cols-12 gap-3 items-center rounded-xl border border-border bg-muted/30 px-4 py-3 hover:bg-primary/5 hover:border-primary/30 transition-all"
                    >
                      <span className="col-span-1 text-muted-foreground text-sm font-medium tabular-nums">
                        {item.rank}
                      </span>
                      <span className="col-span-4 text-foreground font-medium truncate">
                        {item.keyword}
                      </span>
                      <span className="col-span-2">
                        {item.search_volume ? (
                          <Badge variant="secondary" className="text-xs">{item.search_volume}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </span>
                      <span className="col-span-2 text-muted-foreground text-xs">
                        {formatTimeAgo(item.started_at)}
                      </span>
                      <span className="col-span-3 flex flex-wrap gap-1">
                        {(item.analysis_keywords?.length ?? 0) > 0
                          ? item.analysis_keywords.slice(0, 6).map((kw, j) => (
                              <Badge
                                key={j}
                                variant="outline"
                                className="text-xs font-normal cursor-pointer hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedItem({ ...item, keyword: kw })
                                  setDrawerOpen(true)
                                }}
                              >
                                {kw}
                              </Badge>
                            ))
                          : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* 우측 상세 Drawer */}
      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/20 z-40" />
          <Drawer.Content className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-white shadow-xl flex flex-col border-l border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <Drawer.Title className="text-lg font-semibold text-foreground truncate pr-2">
                {selectedItem?.keyword ?? '트렌드 상세'}
              </Drawer.Title>
              <Drawer.Close asChild>
                <button type="button" className="p-1 rounded hover:bg-muted" aria-label="닫기">
                  <X className="h-5 w-5" />
                </button>
              </Drawer.Close>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {selectedItem && (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <BarChart3 className="h-3.5 w-3.5" /> 지난 {trendHours}시간 검색 추이
                    </p>
                    <div className="rounded-lg border border-border bg-muted/20 h-32 flex items-center justify-center text-muted-foreground text-sm">
                      그래프 이미지 (Google Trends 연동 시 표시)
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Newspaper className="h-3.5 w-3.5" /> 관련 뉴스
                    </p>
                    <ul className="space-y-2">
                      <li className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                        관련 뉴스는 &quot;이 키워드로 분석하기&quot; 실행 후 리서치 결과에서 확인할 수 있어요.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" /> 연관 키워드
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedItem.analysis_keywords?.length ?? 0) > 0
                        ? selectedItem.analysis_keywords.map((kw, j) => (
                            <Badge key={j} variant="outline" className="text-xs font-normal">
                              {kw}
                            </Badge>
                          ))
                        : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                    </div>
                  </div>
                  <div className="pt-2">
                    <Button className="w-full" onClick={handleAnalyzeFromDrawer}>
                      이 키워드로 분석하기
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  )
}
