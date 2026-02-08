'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useResearchStore } from '@/lib/stores/research-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TrendingUp, RefreshCw, Loader2 } from 'lucide-react'
import { cn, formatTimeAgo } from '@/lib/utils'
import { showErrorToast } from '@/lib/error-toast'
import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'
import { Badge } from '@/components/ui/badge'

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
  const [trends, setTrends] = useState<Record<string, TrendItem[]>>({ KR: [], US: [], JP: [] })
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const applyData = (data: TrendsResponse) => {
    setTrends({
      KR: normalizeTrendItems(data.KR),
      US: normalizeTrendItems(data.US),
      JP: normalizeTrendItems(data.JP),
    })
    setUpdatedAt(data.updatedAt ?? null)
  }

  const loadTrends = () => {
    setLoading(true)
    fetch('/api/trends')
      .then((res) => parseJsonResponse<TrendsResponse>(res))
      .then(applyData)
      .catch((err) => {
        showErrorToast(err, { fallbackMessage: '트렌드를 불러오지 못했어요.' })
        setTrends({ KR: [], US: [], JP: [] })
        setUpdatedAt(null)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadTrends()
  }, [])

  const handleRefresh = () => {
    setUpdating(true)
    fetch('/api/trends/update', { method: 'POST' })
      .then((res) => parseJsonResponse<{ success?: boolean; data?: TrendsResponse }>(res))
      .then((payload) => {
        if (payload.data) {
          applyData(payload.data)
        } else {
          loadTrends()
        }
      })
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 갱신에 실패했어요.' }))
      .finally(() => setUpdating(false))
  }

  const handleKeywordClick = (keyword: string) => {
    startResearch(keyword)
    router.push(`/results?keyword=${encodeURIComponent(keyword)}`)
  }

  const items = trends[country] ?? []

  return (
    <div className="p-6 md:p-8 w-full max-w-full bg-[#F9FAFB] min-h-screen">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          국가별 트렌드
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          DB에 캐시된 국가별 인기 검색어예요. 갱신 버튼으로 최신 트렌드를 불러올 수 있어요.
        </p>
      </header>

      <Card className="border border-border bg-white shadow-sm w-full">
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2 flex-wrap">
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
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={updating}
            className="gap-1.5"
          >
            {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            트렌드 갱신
          </Button>
        </div>
        <CardHeader>
          <CardTitle className="text-lg">{COUNTRY_LABELS[country] ?? country} 인기 검색어</CardTitle>
          <CardDescription>행 클릭 시 해당 키워드로 분석이 시작돼요. 분석 키워드 배지를 눌러도 이동해요.</CardDescription>
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
              {/* 테이블 헤더: 순위 | 키워드 | 검색량 | 시작일 | 분석 키워드 */}
              <div className="grid grid-cols-12 gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border mb-1">
                <span className="col-span-1">순위</span>
                <span className="col-span-3">키워드</span>
                <span className="col-span-2">검색량</span>
                <span className="col-span-2">시작일</span>
                <span className="col-span-4">분석 키워드</span>
              </div>
              <ul className="space-y-1">
                {items.map((item, i) => (
                  <li key={`${item.keyword}-${i}`}>
                    <button
                      type="button"
                      onClick={() => handleKeywordClick(item.keyword)}
                      className="w-full text-left grid grid-cols-12 gap-3 items-center rounded-xl border border-border bg-muted/30 px-4 py-3 hover:bg-primary/5 hover:border-primary/30 transition-all"
                    >
                      <span className="col-span-1 text-muted-foreground text-sm font-medium tabular-nums">
                        {item.rank}
                      </span>
                      <span className="col-span-3 text-foreground font-medium truncate">
                        {item.keyword}
                      </span>
                      <span className="col-span-2">
                        {item.search_volume ? (
                          <Badge variant="secondary" className="text-xs">{item.search_volume}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </span>
                      <span className="col-span-2 text-muted-foreground text-xs truncate">
                        {item.started_at ?? '—'}
                      </span>
                      <span className="col-span-4 flex flex-wrap gap-1">
                        {(item.analysis_keywords?.length ?? 0) > 0
                          ? item.analysis_keywords.slice(0, 8).map((kw, j) => (
                              <Badge
                                key={j}
                                variant="outline"
                                className="text-xs font-normal cursor-pointer hover:bg-primary/10"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleKeywordClick(kw)
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
        <div className="px-6 pb-4 pt-0">
          <p className="text-muted-foreground text-xs">
            최근 업데이트: {formatTimeAgo(updatedAt)}
          </p>
        </div>
      </Card>
    </div>
  )
}
