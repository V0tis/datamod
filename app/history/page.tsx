'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  Search,
  Loader2,
  ChevronDown,
  Trash2,
  Copy,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react'
import { HistoryCardSkeletonList } from '@/components/research/HistoryCardSkeleton'
import { COUNTRY_CHIP_CODES, COUNTRY_LABELS } from '@/components/country-chips'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useResearchStore } from '@/lib/stores/research-store'
import { DEPTH_LABELS, type DepthMode } from '@/lib/analysis-estimates'
import { formatDisplayKeyword } from '@/lib/format-display-keyword'

const PAGE_SIZE = 10

const TARGET_LABELS: Record<string, string> = {
  product: '제품',
  company: '기업',
  market: '시장',
  person: '인물',
  policy: '정책',
  technology: '기술',
}

const MARKET_TYPE_OPTIONS = Object.keys(TARGET_LABELS).sort()

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
type CountryFilterOption = 'all' | string

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

const SCORE_FILTER_OPTIONS: { value: ScoreFilterOption; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'high', label: '70+' },
  { value: 'medium', label: '40–69' },
  { value: 'low', label: '0–39' },
]

function formatCreatedDate(isoString: string | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function analysisModeLabel(depth: string | null | undefined): string {
  if (depth === 'fast' || depth === 'standard' || depth === 'deep') return DEPTH_LABELS[depth as DepthMode]
  return '표준'
}

function getOpportunityScore(r: ResearchRecord): number | null {
  return r.opportunity_score ?? r.market_temperature_score ?? null
}

function AnalysisStatusBadge({ status }: { status: string | undefined }) {
  const s = status ?? 'completed'
  if (s === 'completed') {
    return (
      <Badge variant="secondary" className="border-emerald-300 bg-emerald-50 text-emerald-800   ">
        {STATUS_LABELS.completed}
      </Badge>
    )
  }
  if (s === 'failed') {
    return (
      <Badge variant="secondary" className="border-red-300 bg-red-50 text-red-800   ">
        {STATUS_LABELS.failed}
      </Badge>
    )
  }
  if (s === 'analyzing' || s === 'queued') {
    return (
      <Badge variant="secondary" className="border-amber-300 bg-amber-50 text-amber-900   ">
        {STATUS_LABELS[s]}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="font-semibold">
      {STATUS_LABELS[s] ?? s}
    </Badge>
  )
}

function buildHistoryListUrl(options: {
  page: number
  searchText: string
  periodFilter: PeriodFilter
  scoreFilter: ScoreFilterOption
  marketTypeFilter: MarketTypeFilterOption
  sortOrder: SortOption
  statusFilter: StatusFilterOption
  countryFilter: CountryFilterOption
}) {
  const params = new URLSearchParams()
  params.set('page', String(options.page))
  params.set('pageSize', String(PAGE_SIZE))
  const q = options.searchText.trim()
  if (q) params.set('q', q)
  if (options.periodFilter !== 'all') params.set('period', options.periodFilter)
  if (options.scoreFilter !== 'all') params.set('score', options.scoreFilter)
  if (options.marketTypeFilter !== 'all') params.set('analysis_target', options.marketTypeFilter)
  if (options.statusFilter !== 'all') params.set('status', options.statusFilter)
  if (options.countryFilter !== 'all') params.set('country', options.countryFilter)
  if (options.sortOrder !== 'newest') params.set('sort', options.sortOrder)
  return `/api/research/history?${params.toString()}`
}

export default function HistoryPage() {
  const router = useRouter()
  const startStreamingResearch = useResearchStore((s) => s.startStreamingResearch)
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [listRefreshing, setListRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)
  const [scoreFilter, setScoreFilter] = useState<ScoreFilterOption>('all')
  const [marketTypeFilter, setMarketTypeFilter] = useState<MarketTypeFilterOption>('all')
  const [sortOrder, setSortOrder] = useState<SortOption>('newest')
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all')
  const [countryFilter, setCountryFilter] = useState<CountryFilterOption>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [totalAllCount, setTotalAllCount] = useState(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE) || 1)

  const filterKey = useMemo(
    () =>
      JSON.stringify({
        debouncedSearch,
        periodFilter,
        scoreFilter,
        marketTypeFilter,
        sortOrder,
        statusFilter,
        countryFilter,
      }),
    [debouncedSearch, periodFilter, scoreFilter, marketTypeFilter, sortOrder, statusFilter, countryFilter]
  )

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  const isFirstLoad = useRef(true)
  const prevFilterKey = useRef(filterKey)

  useEffect(() => {
    const keyChanged = prevFilterKey.current !== filterKey
    prevFilterKey.current = filterKey
    if (keyChanged && page !== 0) {
      setPage(0)
      return
    }

    let cancelled = false
    const initial = isFirstLoad.current

    void (async () => {
      if (initial) setLoading(true)
      else setListRefreshing(true)
      setError(null)
      try {
        const url = buildHistoryListUrl({
          page,
          searchText: debouncedSearch,
          periodFilter,
          scoreFilter,
          marketTypeFilter,
          sortOrder,
          statusFilter,
          countryFilter,
        })
        const res = await fetch(url)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(data?.error ?? '목록을 불러오지 못했습니다.')
          return
        }
        const list = (data.list ?? []) as ResearchRecord[]
        const t = typeof data.total === 'number' ? data.total : list.length
        setRecords(list.map((r) => ({ ...r, analysis_status: r.analysis_status ?? 'completed' })))
        setTotalCount(t)
        setTotalAllCount(typeof data.totalAll === 'number' ? data.totalAll : 0)
        const maxPage = Math.max(0, Math.ceil(t / PAGE_SIZE) - 1)
        setPage((p) => (p > maxPage ? maxPage : p))
      } catch {
        if (!cancelled) setError('목록을 불러오지 못했습니다.')
      } finally {
        if (!cancelled) {
          isFirstLoad.current = false
          setLoading(false)
          setListRefreshing(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [page, filterKey])

  const fetchList = useCallback(async () => {
    isFirstLoad.current = false
    setListRefreshing(true)
    setError(null)
    try {
      const url = buildHistoryListUrl({
        page,
        searchText: debouncedSearch,
        periodFilter,
        scoreFilter,
        marketTypeFilter,
        sortOrder,
        statusFilter,
        countryFilter,
      })
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? '목록을 불러오지 못했습니다.')
        return
      }
      const list = (data.list ?? []) as ResearchRecord[]
      const t = typeof data.total === 'number' ? data.total : list.length
      setRecords(list.map((r) => ({ ...r, analysis_status: r.analysis_status ?? 'completed' })))
      setTotalCount(t)
      setTotalAllCount(typeof data.totalAll === 'number' ? data.totalAll : 0)
      const maxPage = Math.max(0, Math.ceil(t / PAGE_SIZE) - 1)
      setPage((p) => (p > maxPage ? maxPage : p))
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setListRefreshing(false)
    }
  }, [
    page,
    debouncedSearch,
    periodFilter,
    scoreFilter,
    marketTypeFilter,
    sortOrder,
    statusFilter,
    countryFilter,
  ])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchList()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchList])

  useEffect(() => {
    const valid = new Set(records.map((r) => r.id))
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)))
  }, [records])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const deleteBulkSelected = useCallback(async () => {
    const ids = [...selectedIds]
    if (ids.length === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/research/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (res.status === 204) {
        setSelectedIds([])
        toast.success(`${ids.length}건을 삭제했습니다.`)
        await fetchList()
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? '삭제에 실패했습니다.')
      }
    } catch {
      toast.error('삭제에 실패했습니다.')
    } finally {
      setBulkDeleting(false)
    }
  }, [selectedIds, fetchList])

  const deleteRecord = useCallback(
    async (id: string) => {
      setDeletingId(id)
      try {
        const res = await fetch('/api/research/history', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (res.status === 204) {
          setSelectedIds((prev) => prev.filter((x) => x !== id))
          toast.success('삭제되었습니다.')
          await fetchList()
        } else {
          const data = await res.json().catch(() => ({}))
          toast.error(data?.error ?? '삭제에 실패했습니다.')
        }
      } catch {
        toast.error('삭제에 실패했습니다.')
      } finally {
        setDeletingId(null)
      }
    },
    [fetchList]
  )

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

  const handleDeleteAll = useCallback(async () => {
    setClearingAll(true)
    try {
      const res = await fetch('/api/research/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteAll: true }),
      })
      if (res.status === 204) {
        setRecords([])
        setTotalCount(0)
        setTotalAllCount(0)
        setShowDeleteConfirm(false)
        setPage(0)
        setSelectedIds([])
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

  const startItem = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const endItem = Math.min(totalCount, page * PAGE_SIZE + records.length)
  const pageWindowStart = Math.max(0, Math.min(page - 2, totalPages - 5))

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

  if (error && records.length === 0 && totalAllCount === 0) {
    return (
      <div className="rin-page flex flex-col min-h-[40vh]">
        <ErrorState
          title="목록을 불러오지 못했습니다"
          description="일시적인 오류일 수 있습니다. 아래 버튼으로 다시 시도해 주세요."
          recoveryLabel="다시 시도"
          onRecovery={() => {
            setError(null)
            setLoading(true)
            void fetchList().finally(() => setLoading(false))
          }}
          detail={error}
        />
      </div>
    )
  }

  if (totalAllCount === 0) {
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
                <Button variant="primary" size="lg" className="gap-2">
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
    <div className="rin-page relative pb-24">
      <Dialog open={showDeleteConfirm} onOpenChange={(open) => !clearingAll && setShowDeleteConfirm(open)}>
        <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none">
          <div className="rounded-xl border border-border bg-card p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-gray-900">전체 기록을 삭제하시겠습니까?</h3>
            <p className="mb-6 text-sm text-gray-500">
              {totalAllCount}건의 분석 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={clearingAll}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteAll()}
                disabled={clearingAll}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
              >
                {clearingAll ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : '삭제 확인'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <header className="rin-page-header">
        <div>
          <h1 className="rin-page-title">분석 기록</h1>
          <p className="rin-page-subtitle">키워드 · 일시 · 기회 점수 · 분석 모드를 한눈에 확인하세요.</p>
        </div>
      </header>

      {error ? (
        <p className="mb-4 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="rin-pro-card mb-6 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="키워드 검색"
              className="h-11 rounded-xl border-[#E8EAED] bg-[#F8F9FA] pl-10 text-sm placeholder:text-muted-foreground"
              aria-label="키워드 검색"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">국가</span>
            <div className="relative min-w-[140px]">
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value as CountryFilterOption)}
                className="h-11 w-full cursor-pointer rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#2AC1BC]/30"
                aria-label="국가 필터"
              >
                <option value="all">전체</option>
                {COUNTRY_CHIP_CODES.map((code) => (
                  <option key={code} value={code}>
                    {COUNTRY_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
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
        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">기회 점수</span>
            <div className="relative">
              <select
                value={scoreFilter}
                onChange={(e) => setScoreFilter(e.target.value as ScoreFilterOption)}
                className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SCORE_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">시장 유형</span>
            <div className="relative">
              <select
                value={marketTypeFilter}
                onChange={(e) => setMarketTypeFilter(e.target.value as MarketTypeFilterOption)}
                className="h-9 min-w-[100px] cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">전체</option>
                {MARKET_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TARGET_LABELS[t] ?? t}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">상태</span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">정렬</span>
            <div className="relative">
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOption)}
                className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {listRefreshing ? (
        <p className="mb-2 text-xs text-muted-foreground">목록을 불러오는 중…</p>
      ) : null}

      {totalCount === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">검색·필터 결과가 없습니다.</p>
      ) : (
        <ul className="m-0 list-none space-y-0 overflow-hidden rounded-xl border border-gray-100 bg-white p-0 shadow-sm">
          {records.map((record) => {
            const resultsHref = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`
            const opportunityScore = getOpportunityScore(record)

            return (
              <li key={record.id} className="group">
                <div className="flex items-center gap-4 border-b border-gray-100 px-5 py-4 transition-colors last:border-0 hover:bg-gray-50/70">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(record.id)}
                    onChange={() => toggleSelect(record.id)}
                    className={cn(
                      'h-4 w-4 shrink-0 rounded border-[#E8EAED] text-[#2AC1BC] transition-opacity focus:ring-[#2AC1BC]',
                      selectedIds.includes(record.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    )}
                    aria-label={`${formatDisplayKeyword(record.keyword)} 선택`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900" title={record.keyword || undefined}>
                        {formatDisplayKeyword(record.keyword)}
                      </span>
                      <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        {analysisModeLabel(record.analysis_depth)}
                      </span>
                      {record.analysis_target ? (
                        <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-xs text-blue-600">
                          {TARGET_LABELS[record.analysis_target] ?? record.analysis_target}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-400">
                      {formatCreatedDate(record.updated_at)} · {COUNTRY_LABELS[record.country_code] ?? record.country_code}
                    </div>
                  </div>

                  <div className="w-16 shrink-0 text-right">
                    {opportunityScore != null ? (
                      <span className="text-lg font-bold tabular-nums text-gray-900">{opportunityScore}</span>
                    ) : (
                      <span className="text-sm text-gray-300">--</span>
                    )}
                  </div>

                  <div className="shrink-0">
                    <AnalysisStatusBadge status={record.analysis_status} />
                  </div>

                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <Link href={resultsHref}>
                      <button
                        type="button"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        disabled={record.analysis_status !== 'completed'}
                      >
                        {record.analysis_status === 'analyzing' || record.analysis_status === 'queued' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          '보기'
                        )}
                      </button>
                    </Link>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      title="다시 분석"
                      onClick={() => handleDuplicate(record)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                      disabled={deletingId === record.id}
                      onClick={() => deleteRecord(record.id)}
                      aria-label="삭제"
                    >
                      {deletingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {totalCount > 0 ? (
        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-400">
            전체 {totalCount}건 중 {startItem}–{endItem}번째
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="이전 페이지"
            >
              <ChevronLeft className="h-4 w-4 text-gray-600" />
            </button>

            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = pageWindowStart + i
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'h-8 w-8 rounded-lg text-sm font-medium transition-colors',
                    page === pageNum ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {pageNum + 1}
                </button>
              )
            })}

            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="다음 페이지"
            >
              <ChevronRight className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex justify-end border-t border-gray-100 pt-6">
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="flex items-center gap-1.5 text-sm text-red-500 transition-colors hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
          전체 기록 삭제
        </button>
      </div>

      {totalCount > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {searchQuery ||
          periodFilter !== 'all' ||
          scoreFilter !== 'all' ||
          marketTypeFilter !== 'all' ||
          statusFilter !== 'all' ||
          countryFilter !== 'all'
            ? `검색·필터 결과 ${totalCount}건`
            : `총 ${totalAllCount}건`}
        </p>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 transform items-center gap-4 rounded-2xl bg-gray-900 px-6 py-3 text-white shadow-xl">
          <span className="text-sm font-medium">{selectedIds.length}건 선택됨</span>
          <button
            type="button"
            onClick={() => void deleteBulkSelected()}
            disabled={bulkDeleting}
            className="text-sm font-medium text-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {bulkDeleting ? '삭제 중…' : '삭제'}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-sm text-gray-400 hover:text-white"
          >
            취소
          </button>
        </div>
      ) : null}
    </div>
  )
}
