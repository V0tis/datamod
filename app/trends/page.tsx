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

export default function TrendsPage() {
  const router = useRouter()
  const startResearch = useResearchStore((s) => s.startResearch)
  const [country, setCountry] = useState<'KR' | 'US' | 'JP'>('KR')
  const [trends, setTrends] = useState<Record<string, TrendItem[]>>({ KR: [], US: [], JP: [] })
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  const loadTrends = () => {
    setLoading(true)
    fetch('/api/trends')
      .then((res) => parseJsonResponse<TrendsResponse>(res))
      .then((data) => {
        setTrends({
          KR: normalizeTrendItems(data.KR),
          US: normalizeTrendItems(data.US),
          JP: normalizeTrendItems(data.JP),
        })
        setUpdatedAt(data.updatedAt ?? null)
      })
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
      .then((res) => parseJsonResponse<{ success?: boolean }>(res))
      .then(() => loadTrends())
      .catch((err) => showErrorToast(err, { fallbackMessage: '트렌드 갱신에 실패했어요.' }))
      .finally(() => setUpdating(false))
  }

  const handleKeywordClick = (keyword: string) => {
    startResearch(keyword)
    router.push(`/results?keyword=${encodeURIComponent(keyword)}`)
  }

  const items = trends[country] ?? []

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto bg-[#F8F9FA] min-h-screen">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          국가별 트렌드
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          DB에 캐시된 국가별 인기 검색어예요. 갱신 버튼으로 최신 트렌드를 불러올 수 있어요.
        </p>
      </header>

      <Card className="border border-border bg-white shadow-sm">
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
          <CardDescription>클릭 시 해당 키워드로 분석이 시작돼요.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              아직 캐시된 트렌드가 없어요. &quot;트렌드 갱신&quot;을 눌러 주세요.
            </p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={`${item.keyword}-${i}`}>
                  <button
                    type="button"
                    onClick={() => handleKeywordClick(item.keyword)}
                    className="w-full text-left rounded-xl border border-border bg-muted/30 px-4 py-3.5 hover:bg-primary/5 hover:border-primary/30 transition-all flex flex-col gap-1.5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-sm font-medium w-6">{item.rank}</span>
                      <span className="text-foreground font-medium flex-1 truncate">{item.keyword}</span>
                      {item.search_volume && (
                        <Badge variant="secondary" className="text-xs shrink-0">{item.search_volume}</Badge>
                      )}
                    </div>
                    {(item.started_at || (item.analysis_keywords?.length ?? 0) > 0) && (
                      <div className="flex flex-wrap items-center gap-1.5 pl-9 text-xs text-muted-foreground">
                        {item.started_at && <span>{item.started_at}</span>}
                        {item.analysis_keywords?.length > 0 && (
                          <span className="flex flex-wrap gap-1">
                            {item.analysis_keywords.slice(0, 5).map((kw, j) => (
                              <Badge key={j} variant="outline" className="text-xs font-normal cursor-pointer" onClick={(e) => { e.stopPropagation(); handleKeywordClick(kw); }}>
                                {kw}
                              </Badge>
                            ))}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
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
