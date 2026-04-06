'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Loader2, ChevronDown, Trash2, Copy, Eye, BarChart3 } from 'lucide-react'
import { HistoryCardSkeletonList } from '@/components/research/HistoryCardSkeleton'
import { COUNTRY_LABELS } from '@/components/country-chips'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useResearchStore } from '@/lib/stores/research-store'
import { DEPTH_LABELS, type DepthMode } from '@/lib/analysis-estimates'

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
  analysis_depth?: string | null
  confidence_score?: number | null
  market_temperature_score?: number | null
  opportunity_score?: number | null
  summary_insights?: string | null
  top_risk?: string | null
  top_action?: string | null
  updated_at: string | null
  date: string
}

type PeriodFilter = 'all' | '1m' | '3m' | '6m'
type ScoreFilterOption = 'all' | 'high' | 'medium' | 'low'
type MarketTypeFilterOption = 'all' | string
type SortOption = 'newest' | 'oldest'
type StatusFilterOption = 'all' | 'completed' | 'failed'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: '최신순' },
  { value: 'oldest', label: '오래된순' },
]

const STATUS_FILTER_OPTIONS: { value: StatusFilterOption; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
]

const STATUS_LABELS: Record<string, string> = {
  completed: '완료',
  failed: '실패',
  analyzing: '분석 중',
  queued: '대기 중',
}

const PERIOD_CHIPS: { value: PeriodFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: '1m', label: '1개월' },
  { value: '3m', label: '3개월' },
  { value: '6m', label: '6개월' },
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

function formatDateTime(isoString: string | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return `${formatCreatedDate(isoString)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function analysisModeLabel(depth: string | null | undefined): string {
  if (depth === 'fast' || depth === 'standard' || depth === 'deep') return DEPTH_LABELS[depth as DepthMode]
  return '표준'
}

function getOpportunityScore(r: ResearchRecord): number | null {
  return r.opportunity_score ?? r.market_temperature_score ?? null
}

export default function HistoryPage() {
  const router = useRouter()
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [clearAllOpen, setClearAllOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [scoreFilter, setScoreFilter] = useState<ScoreFilterOption>('all')
  const [marketTypeFilter, setMarketTypeFilter] = useState<MarketTypeFilterOption>('all')
  const [sortOrder, setSortOrder] = useState<SortOption>('newest')
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all')

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

    if (periodFilter !== 'all') {
      const months = periodFilter === '1m' ? 1 : periodFilter === '3m' ? 3 : 6
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      result = result.filter((r) => {
        if (!r.updated_at) return false
        return new Date(r.updated_at) >= cutoff
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

    if (statusFilter !== 'all') {
      result = result.filter((r) => (r.analysis_status ?? 'completed') === statusFilter)
    }

    const sorted = [...result]
    sorted.sort((a, b) => {
      const da = new Date(a.updated_at ?? a.date ?? 0).getTime()
      const db = new Date(b.updated_at ?? b.date ?? 0).getTime()
      return sortOrder === 'newest' ? db - da : da - db
    })
    return sorted
  }, [records, searchQuery, periodFilter, scoreFilter, marketTypeFilter, statusFilter, sortOrder])

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

  const deleteRecord = useCallback(async (id: string) => {
    setDeletingId(id)
    try {
      const res = await fetch('/api/research/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.status === 204) {
        setRecords((prev) => prev.filter((r) => r.id !== id))
        toast.success('삭제되었습니다.')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? '삭제에 실패했습니다.')
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }, [])

  const handleDuplicate = useCallback(
    async (record: ResearchRecord) => {
      try {
        await startStreamingResearch(record.keyword, { country_code: record.country_code || undefined })
        const href = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`
        router.push(href)
      } catch {
        toast.error('복제에 실패했습니다.')
      }
    },
    [router, startStreamingResearch]
  )

  const handleClearAll = useCallback(async () => {
    setClearingAll(true)
    try {
      const res = await fetch('/api/research/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      })
      if (res.status === 204) {
        setRecords([])
        setClearAllOpen(false)
        toast.success('모든 분석 로그가 삭제되었습니다.')
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data?.error ?? '삭제에 실패했습니다.')
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setClearingAll(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="rin-page">
        <header className="rin-page-header">
          <h1 className="rin-page-title">분석 기록</h1>
          <p className="rin-page-subtitle">완료된 리서치를 키워드·일시·점수로 빠르게 찾습니다.</p>
        </header>
        <HistoryCardSkeletonList count={6} grid />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rin-page flex flex-col min-h-[40vh]">
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
      <div className="rin-page min-h-[60vh]">
        <header className="rin-page-header">
          <h1 className="rin-page-title">분석 기록</h1>
          <p className="rin-page-subtitle">아직 저장된 분석이 없습니다. 대시보드에서 첫 키워드를 실행해 보세요.</p>
        </header>
        <div className="rin-empty-container">
          <EmptyState
            title="기록이 없습니다"
            description="시장 키워드 분석을 실행하면 여기에 일시·점수와 함께 쌓입니다."
            icon={<BarChart3 className="h-12 w-12 text-primary/70" strokeWidth={1.5} />}
            action={
              <Link href="/">
                <Button variant="default" size="lg" className="gap-2">
                  <Search className="w-4 h-4" />
                  시장 분석 시작하기
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rin-page">
      <header className="rin-page-header flex items-start justify-between gap-4">
        <div>
          <h1 className="rin-page-title">분석 기록</h1>
          <p className="rin-page-subtitle">키워드 · 일시 · 기회 점수 · 분석 모드를 한눈에 확인하세요.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-destructive border-destructive/50 hover:bg-destructive/10"
          onClick={() => setClearAllOpen(true)}
        >
          분석 로그 전체 삭제
        </Button>
      </header>

      {clearAllOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-all-title"
        >
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => !clearingAll && setClearAllOpen(false)}
            aria-hidden
          />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card shadow-xl p-5">
            <h2 id="clear-all-title" className="font-semibold text-foreground mb-2">
              모든 분석 로그를 삭제하시겠습니까?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              삭제된 로그는 복구할 수 없습니다.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={clearingAll}
                onClick={() => setClearAllOpen(false)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={clearingAll}
                onClick={handleClearAll}
              >
                {clearingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : '삭제'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="rin-pro-card mb-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="키워드 검색"
            className="h-11 rounded-xl border-[#E8EAED] bg-[#F8F9FA] pl-10 text-sm placeholder:text-muted-foreground"
            aria-label="검색"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">기간</span>
          {PERIOD_CHIPS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setPeriodFilter(c.value)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                periodFilter === c.value
                  ? 'border-[#2AC1BC] bg-[#E8FAF9] text-[#222]'
                  : 'border-border bg-white text-muted-foreground hover:border-[#2AC1BC]/50'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 items-center border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">점수</span>
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
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">상태</span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                className="h-9 rounded-lg border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">정렬</span>
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOption)}
                className="h-9 rounded-lg border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
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
        <ul className="space-y-3 list-none p-0 m-0">
          {filteredRecords.map((record) => {
            const resultsHref = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`
            const opportunityScore = getOpportunityScore(record)

            return (
              <li key={record.id}>
                <article
                  className={cn(
                    'rin-pro-card flex flex-col gap-4 p-4 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-6',
                    (record.analysis_status === 'analyzing' || record.analysis_status === 'queued') && 'opacity-80'
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold tracking-tight text-foreground">{record.keyword}</h3>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {analysisModeLabel(record.analysis_depth)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span className="tabular-nums">{formatDateTime(record.updated_at)}</span>
                      {record.country_code ? (
                        <span>{COUNTRY_LABELS[record.country_code] ?? record.country_code}</span>
                      ) : null}
                      {record.analysis_target ? (
                        <span>{TARGET_LABELS[record.analysis_target] ?? record.analysis_target}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:shrink-0">
                    {opportunityScore != null ? (
                      <span
                        className={cn(
                          'inline-flex min-w-[3.5rem] items-center justify-center rounded-lg px-3 py-2 text-lg font-bold tabular-nums',
                          opportunityScore >= 70 && 'bg-[#E8FAF9] text-[#0d9488]',
                          opportunityScore >= 40 && opportunityScore < 70 && 'bg-muted text-foreground',
                          opportunityScore < 40 && 'bg-red-50 text-[#FF5F5F] dark:bg-red-950/30 dark:text-red-300'
                        )}
                      >
                        {opportunityScore}
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">점수 —</span>
                    )}
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-bold',
                        record.analysis_status === 'completed' && 'bg-[#E8FAF9] text-[#0f766e]',
                        record.analysis_status === 'failed' && 'bg-red-50 text-[#FF5F5F]',
                        (record.analysis_status === 'analyzing' || record.analysis_status === 'queued') && 'bg-amber-50 text-amber-800'
                      )}
                    >
                      {STATUS_LABELS[record.analysis_status ?? 'completed'] ?? '완료'}
                    </span>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Link href={resultsHref}>
                        <Button
                          size="sm"
                          className="h-9 rounded-lg bg-[#2AC1BC] font-semibold text-white hover:bg-[#26b0ab]"
                          disabled={record.analysis_status !== 'completed'}
                        >
                          {record.analysis_status === 'analyzing' || record.analysis_status === 'queued' ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Eye className="mr-1 h-4 w-4" />
                              보기
                            </>
                          )}
                        </Button>
                      </Link>
                      <Button size="sm" variant="outline" className="h-9" title="다시 분석" onClick={() => handleDuplicate(record)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 text-[#FF5F5F] border-[#FF5F5F]/40 hover:bg-red-50"
                        disabled={deletingId === record.id}
                        onClick={() => deleteRecord(record.id)}
                        aria-label="삭제"
                      >
                        {deletingId === record.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {filteredRecords.length > 0 && (
        <p className="text-sm text-muted-foreground mt-8">
          {searchQuery || periodFilter !== 'all' || scoreFilter !== 'all' || marketTypeFilter !== 'all' || statusFilter !== 'all'
            ? `검색·필터 결과 ${filteredRecords.length}건`
            : `총 ${records.length}건`}
        </p>
      )}
    </div>
  )
}
