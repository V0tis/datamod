'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Trash2, Loader2, Filter, X, Check, ChevronDown, Columns, Calendar } from 'lucide-react'
import { HistoryCardSkeletonList } from '@/components/research/HistoryCardSkeleton'
import { TimeAgo } from '@/components/time-ago'
import { COUNTRY_LABELS } from '@/components/country-chips'
import { cn } from '@/lib/utils'
import { type AnalysisMode, ANALYSIS_MODE_CONFIG } from '@/lib/types/analysis-modes'
import { ComparisonView } from '@/components/research/comparison-view'

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
  analysis_mode?: AnalysisMode
  market_temperature_score?: number | null
  summary_insights?: string | null
  top_risk?: string | null
  top_action?: string | null
  updated_at: string | null
  date: string
}

type DateFilterOption = 'all' | 'today' | 'week' | 'month'
type TempFilterOption = 'all' | 'hot' | 'warm' | 'cold'

const DATE_FILTER_OPTIONS: { value: DateFilterOption; label: string }[] = [
  { value: 'all', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
]

const TEMP_FILTER_OPTIONS: { value: TempFilterOption; label: string; range: [number, number] | null }[] = [
  { value: 'all', label: '전체', range: null },
  { value: 'hot', label: '고온 (70+)', range: [70, 100] },
  { value: 'warm', label: '중간 (40-69)', range: [40, 69] },
  { value: 'cold', label: '저온 (0-39)', range: [0, 39] },
]

export default function HistoryPage() {
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [showFilters, setShowFilters] = useState(false)
  const [modeFilter, setModeFilter] = useState<AnalysisMode | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all')
  const [tempFilter, setTempFilter] = useState<TempFilterOption>('all')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showComparison, setShowComparison] = useState(false)

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 3) return prev
        next.add(id)
      }
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setShowComparison(false)
  }, [])

  const filteredRecords = useMemo(() => {
    let result = records

    const q = filter.trim().toLowerCase()
    if (q) {
      result = result.filter((r) =>
        r.keyword.toLowerCase().includes(q) ||
        (COUNTRY_LABELS[r.country_code] ?? r.country_code).toLowerCase().includes(q)
      )
    }

    if (modeFilter !== 'all') {
      result = result.filter((r) => r.analysis_mode === modeFilter)
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
          case 'today': return date >= startOfToday
          case 'week': return date >= startOfWeek
          case 'month': return date >= startOfMonth
          default: return true
        }
      })
    }

    if (tempFilter !== 'all') {
      const range = TEMP_FILTER_OPTIONS.find((o) => o.value === tempFilter)?.range
      if (range) {
        result = result.filter((r) => {
          const score = r.market_temperature_score
          return score != null && score >= range[0] && score <= range[1]
        })
      }
    }

    return result
  }, [records, filter, modeFilter, dateFilter, tempFilter])

  const selectedRecords = useMemo(() =>
    records.filter((r) => selectedIds.has(r.id)),
    [records, selectedIds]
  )

  const hasActiveFilters = modeFilter !== 'all' || dateFilter !== 'all' || tempFilter !== 'all'

  const clearFilters = useCallback(() => {
    setModeFilter('all')
    setDateFilter('all')
    setTempFilter('all')
  }, [])

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/research/history')
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

  const handleDelete = async (id: string) => {
    if (!confirm('이 리서치 기록을 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch('/api/research/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id))
      } else {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? '삭제에 실패했습니다.')
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto min-h-screen bg-background">
        <header className="mb-8">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            과거 결정과 신호
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            최근 분석한 시장 — 결과로 바로 이동합니다.
          </p>
        </header>
        <HistoryCardSkeletonList count={5} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto flex flex-col min-h-[40vh] bg-background">
        <ErrorState
          title="목록을 불러오지 못했습니다"
          description="일시적인 오류일 수 있습니다. 아래 버튼으로 다시 시도해 주세요."
          recoveryLabel="다시 시도"
          onRecovery={() => { setError(null); fetchList() }}
          detail={error}
        />
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="p-6 md:p-8 max-w-2xl mx-auto min-h-[60vh] bg-background">
        <header className="mb-8">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">과거 결정과 신호</h1>
          <p className="text-muted-foreground text-sm mt-1">최근 분석한 시장 — 결과로 바로 이동합니다.</p>
        </header>
        <div className="rounded-lg border border-border/60 bg-background/50 py-12 px-6 text-center">
          <EmptyState
            title="기록이 없습니다"
            description="키워드를 검색하면 리서치 결과가 여기에 쌓입니다. 메인에서 검색해 보세요."
            icon={null}
            action={
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2">
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
    <div className="p-6 md:p-8 max-w-2xl mx-auto min-h-screen bg-background">
      <header className="mb-8">
        <h1 className="text-xl font-semibold text-foreground tracking-tight">
          과거 결정과 신호
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          최근 분석한 시장 — 결과로 바로 이동합니다.
        </p>
      </header>

      {records.length > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="키워드·국가로 검색"
                className="pl-9 h-9 text-sm border-border/60 bg-background placeholder:text-muted-foreground"
                aria-label="리서치 기록 검색"
              />
            </div>
            <Button
              variant={showFilters ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn('gap-1.5 h-9', hasActiveFilters && 'border-primary text-primary')}
            >
              <Filter className="h-4 w-4" />
              필터
              {hasActiveFilters && (
                <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                  {[modeFilter !== 'all', dateFilter !== 'all', tempFilter !== 'all'].filter(Boolean).length}
                </span>
              )}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowComparison(true)}
                className="gap-1.5 h-9"
              >
                <Columns className="h-4 w-4" />
                비교 ({selectedIds.size})
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="rounded-lg border border-border/60 bg-card p-4 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">필터 옵션</span>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    필터 초기화
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">분석 모드</label>
                  <div className="relative">
                    <select
                      value={modeFilter}
                      onChange={(e) => setModeFilter(e.target.value as AnalysisMode | 'all')}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="all">전체 모드</option>
                      {Object.values(ANALYSIS_MODE_CONFIG).map((config) => (
                        <option key={config.id} value={config.id}>{config.labelKo}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">기간</label>
                  <div className="relative">
                    <select
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {DATE_FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">시장 온도</label>
                  <div className="relative">
                    <select
                      value={tempFilter}
                      onChange={(e) => setTempFilter(e.target.value as TempFilterOption)}
                      className="w-full h-9 rounded-md border border-border bg-background px-3 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {TEMP_FILTER_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
              <span className="text-sm text-foreground">
                {selectedIds.size}개 선택됨 (최대 3개)
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                선택 해제
              </button>
            </div>
          )}
        </div>
      )}

      {filteredRecords.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          검색어에 맞는 기록이 없습니다.
        </p>
      ) : (
        <ul className="space-y-1 list-none p-0 m-0">
          {filteredRecords.map((record) => {
            const resultsHref = `/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`
            const isSelected = selectedIds.has(record.id)
            return (
              <li key={record.id}>
                <article className={cn(
                  'group rounded-xl border bg-card py-4 px-4 sm:px-5 transition-colors hover:shadow-sm',
                  isSelected
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-border/60 hover:border-border'
                )}>
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelection(record.id)}
                      disabled={!isSelected && selectedIds.size >= 3}
                      className={cn(
                        'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                        isSelected
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'border-border bg-background hover:border-primary/50',
                        !isSelected && selectedIds.size >= 3 && 'opacity-50 cursor-not-allowed'
                      )}
                      aria-label={isSelected ? '선택 해제' : '비교 선택'}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
                      <Link
                        href={resultsHref}
                        className="flex-1 min-w-0 rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground">{record.keyword}</h3>
                          <span className="text-[11px] text-muted-foreground bg-muted/60 rounded px-1.5 py-0.5 shrink-0">
                            {COUNTRY_LABELS[record.country_code] ?? record.country_code}
                          </span>
                          {record.analysis_mode && (
                            <span className="text-[11px] text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">
                              {ANALYSIS_MODE_CONFIG[record.analysis_mode]?.labelKo ?? record.analysis_mode}
                            </span>
                          )}
                          {record.analysis_target && (
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {TARGET_LABELS[record.analysis_target] ?? record.analysis_target}
                            </span>
                          )}
                          {record.analysis_status === 'analyzing' || record.analysis_status === 'queued' ? (
                            <span className="text-[11px] text-amber-600 dark:text-amber-500 font-medium shrink-0">분석 중</span>
                          ) : record.analysis_status === 'failed' ? (
                            <span className="text-[11px] text-destructive font-medium shrink-0">실패</span>
                          ) : null}
                        </div>
                        {record.updated_at && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            <TimeAgo isoString={record.updated_at} />
                          </p>
                        )}
                        {record.analysis_status === 'completed' && (
                          <div className="mt-2 space-y-1">
                            {record.market_temperature_score != null && (
                              <p className="text-xs text-muted-foreground">
                                시장 온도 {record.market_temperature_score}/100
                              </p>
                            )}
                            {record.summary_insights && (
                              <p className="text-sm text-foreground line-clamp-1">{record.summary_insights}</p>
                            )}
                            {record.top_action && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                우선 액션: {record.top_action}
                              </p>
                            )}
                            {record.top_risk && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                리스크: {record.top_risk}
                              </p>
                            )}
                          </div>
                        )}
                      </Link>
                      <div className="flex shrink-0 gap-1">
                        <Link
                          href={resultsHref}
                          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline py-2 px-2 -m-2"
                        >
                          결과
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.preventDefault()
                            handleDelete(record.id)
                          }}
                          disabled={deletingId === record.id}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          aria-label="기록 삭제"
                        >
                          {deletingId === record.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}

      {filteredRecords.length > 0 && (
        <p className="text-sm text-muted-foreground mt-6">
          {filter || hasActiveFilters
            ? `검색/필터 결과 ${filteredRecords.length}건`
            : `총 ${records.length}건`}
        </p>
      )}

      {showComparison && selectedRecords.length > 0 && (
        <ComparisonView
          records={selectedRecords}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  )
}
