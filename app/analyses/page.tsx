'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, ChevronRight, Loader2 } from 'lucide-react'
import { HistoryCardSkeletonList } from '@/components/research/HistoryCardSkeleton'
import { COUNTRY_LABELS } from '@/components/country-chips'
import { cn } from '@/lib/utils'

interface AnalysisRecord {
  id: string
  report_id: string | null
  market_keyword: string
  product_name: string | null
  generated_insights: { summary?: string; insights?: string[] } | null
  strategy_recommendation: string | null
  action_plan: Array<{ title?: string; description?: string }> | null
  country_code: string
  created_at: string | null
  date: string
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function truncate(s: string | null | undefined, len: number): string {
  if (!s || typeof s !== 'string') return '—'
  return s.length <= len ? s : s.slice(0, len).trim() + '…'
}

export default function MyAnalysesPage() {
  const router = useRouter()
  const [records, setRecords] = useState<AnalysisRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const fetchList = useCallback(async () => {
    try {
      const q = searchQuery.trim()
      const url = q ? `/api/analyses?q=${encodeURIComponent(q)}&limit=100` : '/api/analyses?limit=100'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      setRecords(data.list ?? [])
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(fetchList, searchQuery ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchList, searchQuery])

  const openResult = (r: AnalysisRecord) => {
    const href = r.report_id
      ? `/results/${r.report_id}`
      : `/results?keyword=${encodeURIComponent(r.market_keyword)}${r.country_code ? `&country=${encodeURIComponent(r.country_code)}` : ''}`
    router.push(href)
  }

  if (loading && records.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-screen bg-background">
        <header className="mb-5">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">내 분석</h1>
          <p className="text-muted-foreground text-xs mt-0.5">저장된 AI 분석 결과</p>
        </header>
        <HistoryCardSkeletonList count={6} grid />
      </div>
    )
  }

  if (error && records.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto flex flex-col min-h-[40vh] bg-background">
        <ErrorState
          title="목록을 불러오지 못했습니다"
          description="일시적인 오류일 수 있습니다. 아래 버튼으로 다시 시도해 주세요."
          recoveryLabel="다시 시도"
          onRecovery={() => {
            setError(null)
            fetchList()
          }}
          detail={error}
        />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-[60vh] bg-background">
        <header className="mb-5">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">내 분석</h1>
          <p className="text-muted-foreground text-xs mt-0.5">저장된 AI 분석 결과</p>
        </header>
        <div className="rounded-xl border border-border/60 bg-card/50 py-16 px-6 text-center">
          <EmptyState
            title="분석 기록이 없습니다"
            description="시장 분석을 실행하면 결과가 여기에 저장됩니다. 메인에서 검색 후 분석을 실행해 보세요."
            icon={null}
            action={
              <Link href="/">
                <Button variant="default" size="sm" className="gap-2">
                  <Search className="w-4 h-4" />
                  분석하러 가기
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-screen bg-background">
      <header className="mb-5">
        <h1 className="text-lg font-semibold text-foreground tracking-tight">내 분석</h1>
        <p className="text-muted-foreground text-xs mt-0.5">저장된 AI 분석 결과 · {records.length}건</p>
      </header>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="키워드, 제품명, 전략으로 검색..."
          className="pl-10 h-11 text-sm border-border/60 bg-background placeholder:text-muted-foreground rounded-lg"
          aria-label="검색"
        />
      </div>

      <div className="space-y-3">
        {records.map((record) => (
          <article
            key={record.id}
            className={cn(
              'group rounded-xl border border-border/60 bg-card p-4 sm:p-5 transition-all hover:border-primary/40 hover:shadow-md cursor-pointer'
            )}
            onClick={() => openResult(record)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                openResult(record)
              }
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  {record.market_keyword}
                </h3>
                {record.product_name && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {truncate(record.product_name, 80)}
                  </p>
                )}
                {record.country_code && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {COUNTRY_LABELS[record.country_code] ?? record.country_code}
                  </p>
                )}

                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {record.generated_insights?.summary && (
                    <p className="line-clamp-2">{truncate(record.generated_insights.summary, 120)}</p>
                  )}
                  {record.strategy_recommendation && !record.generated_insights?.summary && (
                    <p className="line-clamp-2">{truncate(record.strategy_recommendation, 120)}</p>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {formatDate(record.created_at)}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-2 self-start sm:self-center"
                onClick={(e) => {
                  e.stopPropagation()
                  openResult(record)
                }}
              >
                결과 보기
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </article>
        ))}
      </div>

      {records.length > 0 && (
        <p className="text-sm text-muted-foreground mt-6">
          {searchQuery ? `검색 결과 ${records.length}건` : `총 ${records.length}건`}
        </p>
      )}
    </div>
  )
}
