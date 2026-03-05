'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Loader2, ChevronDown, ChevronRight } from 'lucide-react'
import { HistoryCardSkeletonList } from '@/components/research/HistoryCardSkeleton'
import { COUNTRY_LABELS } from '@/components/country-chips'
import { cn } from '@/lib/utils'

const TARGET_LABELS: Record<string, string> = {
  product: '제품',
  company: '기업',
  market: '시장',
  person: '인물',
  policy: '정책',
  technology: '기술',
}

interface ResearchRecord {
  id: string
  keyword: string
  country_code: string
  report_id: string | null
  analysis_status?: 'queued' | 'analyzing' | 'completed' | 'failed'
  analysis_target?: string | null
  confidence_score?: number | null
  market_temperature_score?: number | null
  opportunity_score?: number | null
  summary_insights?: string | null
  top_risk?: string | null
  top_action?: string | null
  updated_at: string | null
  date: string
}

type DateFilterOption = 'all' | 'today' | 'week' | 'month'
type ScoreFilterOption = 'all' | 'high' | 'medium' | 'low'
type MarketTypeFilterOption = 'all' | string

const DATE_FILTER_OPTIONS: { value: DateFilterOption; label: string }[] = [
  { value: 'all', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

const SCORE_FILTER_OPTIONS: { value: ScoreFilterOption; label: string; range: [number, number] | null }[] = [
  { value: 'all', label: '전체', range: null },
  { value: 'high', label: '70+', range: [70, 100] },
  { value: 'medium', label: '40–69', range: [40, 69] },
  { value: 'low', label: '0–39', range: [0, 39] },
]

function formatCreatedDate(isoString: string | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function getOpportunityScore(r: ResearchRecord): number | null {
  return r.opportunity_score ?? r.market_temperature_score ?? null
}

export default function HistoryPage() {
  const router = useRouter()
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilterOption>('all')
  const [marketTypeFilter, setMarketTypeFilter] = useState<MarketTypeFilterOption>('all')

  const filteredRecords = useMemo(() => {
    let result = records

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      result = result.filter(
        (r) =>
          r.keyword.toLowerCase().includes(q) ||
          (COUNTRY_LABELS[r.country_code] ?? r.country_code).toLowerCase().includes(q) ||
          (TARGET_LABELS[r.analysis_target ?? ''] ?? r.analysis_target ?? '').toLowerCase().includes(q)
      )
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfWeek = new Date(startOfToday)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      result = result.filter((r) => {
        if (!r.updated_at) return false
        const date = new Date(r.updated_at)
        switch (dateFilter) {
          case 'today':
            return date >= startOfToday
          case 'week':
            return date >= startOfWeek
          case 'month':
            return date >= startOfMonth
          default:
            return true
        }
      })
    }

    if (scoreFilter !== 'all') {
      const range = SCORE_FILTER_OPTIONS.find((o) => o.value === scoreFilter)?.range
      if (range) {
        result = result.filter((r) => {
          const score = getOpportunityScore(r)
          return score != null && score >= range[0] && score <= range[1]
        })
      }
    }

    if (marketTypeFilter !== 'all') {
      result = result.filter((r) => (r.analysis_target ?? '') === marketTypeFilter)
    }

    return result
  }, [records, searchQuery, dateFilter, scoreFilter, marketTypeFilter])

  const marketTypes = useMemo(() => {
    const set = new Set<string>()
    records.forEach((r) => {
      const t = r.analysis_target?.trim()
      if (t) set.add(t)
    })
    return Array.from(set).sort()
  }, [records])

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/research/history?limit=200&offset=0')
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      const list = (data.list ?? []) as ResearchRecord[]
      setRecords(list.map((r) => ({ ...r, analysis_status: r.analysis_status ?? 'completed' })))
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  useEffect(() => {
    const onVisible = () => fetchList()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisible)
      return () => document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchList])

  const goToReport = (record: ResearchRecord) => {
    const href = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`
    router.push(href)
  }

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto min-h-screen bg-background">
        <header className="mb-5">
          <h1 className="text-lg font-semibold text-foreground tracking-tight">리서치 아카이브</h1>
          <p className="text-muted-foreground text-xs mt-0.5">PM을 위한 분석 기록 보관소</p>
        </header>
        <HistoryCardSkeletonList count={6} grid />
      </div>
    )
  }

  if (error) {
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
          <h1 className="text-lg font-semibold text-foreground tracking-tight">리서치 아카이브</h1>
          <p className="text-muted-foreground text-xs mt-0.5">PM을 위한 분석 기록 보관소</p>
        </header>
        <div className="rounded-xl border border-border/60 bg-card/50 py-16 px-6 text-center">
          <EmptyState
            title="기록이 없습니다"
            description="키워드를 검색하면 리서치 결과가 여기에 쌓입니다. 메인에서 검색해 보세요."
            icon={null}
            action={
              <Link href="/">
                <Button variant="default" size="sm" className="gap-2">
                  <Search className="w-4 h-4" />
                  검색하러 가기
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
        <h1 className="text-lg font-semibold text-foreground tracking-tight">리서치 아카이브</h1>
        <p className="text-muted-foreground text-xs mt-0.5">PM을 위한 분석 기록 보관소</p>
      </header>

      <div className="space-y-4 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search analyses..."
            className="pl-10 h-11 text-sm border-border/60 bg-background placeholder:text-muted-foreground rounded-lg"
            aria-label="검색"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Date</span>
            <div className="relative">
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
                className="h-9 rounded-lg border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DATE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Score</span>
            <div className="relative">
              <select
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value as ScoreFilterOption)}
                className="h-9 rounded-lg border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SCORE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Market type</span>
            <div className="relative">
              <select
                value={marketTypeFilter}
                onChange={(e) => setMarketTypeFilter(e.target.value as MarketTypeFilterOption)}
                className="h-9 rounded-lg border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring min-w-[100px]"
              >
                <option value="all">전체</option>
                {marketTypes.map((t) => (
                  <option key={t} value={t}>{TARGET_LABELS[t] ?? t}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {filteredRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">
          검색·필터 결과가 없습니다.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredRecords.map((record) => {
            const resultsHref = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`
            const opportunityScore = getOpportunityScore(record)
            const confidence = record.confidence_score ?? null

            return (
              <article
                key={record.id}
                className={cn(
                  'group rounded-lg border border-border/60 bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md cursor-pointer',
                  (record.analysis_status === 'analyzing' || record.analysis_status === 'queued') && 'opacity-75'
                )}
                onClick={() => record.analysis_status === 'completed' && goToReport(record)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && record.analysis_status === 'completed') {
                    e.preventDefault()
                    goToReport(record)
                  }
                }}
              >
                <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                  {record.keyword}
                </h3>
                {record.country_code && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {COUNTRY_LABELS[record.country_code] ?? record.country_code}
                    {record.analysis_target && ` · ${TARGET_LABELS[record.analysis_target] ?? record.analysis_target}`}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Opportunity Score</span>
                    <p className="font-semibold text-foreground">
                      {opportunityScore != null ? opportunityScore : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confidence</span>
                    <p className="font-semibold text-foreground">
                      {confidence != null ? `${confidence}%` : '—'}
                    </p>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground mt-3">
                  Created {formatCreatedDate(record.updated_at)}
                </p>

                <div className="mt-4 pt-4 border-t border-border/60" onClick={(e) => e.stopPropagation()}>
                  <Link href={resultsHref}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full gap-2 group/btn"
                      disabled={record.analysis_status !== 'completed'}
                    >
                      {record.analysis_status === 'analyzing' || record.analysis_status === 'queued' ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          분석 중...
                        </>
                      ) : (
                        <>
                          View Report
                          <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </Button>
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {filteredRecords.length > 0 && (
        <p className="text-sm text-muted-foreground mt-8">
          {searchQuery || dateFilter !== 'all' || scoreFilter !== 'all' || marketTypeFilter !== 'all'
            ? `검색·필터 결과 ${filteredRecords.length}건`
            : `총 ${records.length}건`}
        </p>
      )}
    </div>
  )
}
