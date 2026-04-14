'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Download, Trash2, Loader2 } from 'lucide-react'
import { COUNTRY_LABELS } from '@/components/country-chips'
import { InsightCard } from '@/components/insights/InsightCard'
import { SavedInsightsEmptyIllustration } from '@/components/insights/saved-insights-empty-illustration'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { SavedInsight } from '@/lib/insights-types'

export default function InsightsPage() {
  const [list, setList] = useState<SavedInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [marketFilter, setMarketFilter] = useState<string>('all')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/insights')
      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? '목록을 불러오지 못했습니다.')
        return
      }
      setList((data.list ?? []) as SavedInsight[])
    } catch {
      setError('목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const marketCodes = useMemo(() => {
    const codes = new Set<string>()
    list.forEach((i) => codes.add(i.snapshot?.countryCode ?? 'KR'))
    return Array.from(codes).sort()
  }, [list])

  const filteredList = useMemo(() => {
    let result = list
    if (marketFilter !== 'all') {
      result = result.filter((item) => (item.snapshot?.countryCode ?? 'KR') === marketFilter)
    }
    const q = filter.trim().toLowerCase()
    if (!q) return result
    return result.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(q)
      const keywordMatch = item.snapshot?.keyword?.toLowerCase().includes(q)
      const noteMatch = item.note?.toLowerCase().includes(q)
      const summaryMatch = (item.snapshot?.summary ?? item.snapshot?.strategicSummary?.summary ?? '')
        .toLowerCase()
        .includes(q)
      return nameMatch || keywordMatch || noteMatch || summaryMatch
    })
  }, [list, filter, marketFilter])

  const visibleIds = useMemo(() => filteredList.map((i) => i.id), [filteredList])
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))

  useEffect(() => {
    const valid = new Set(list.map((i) => i.id))
    setSelectedIds((prev) => {
      let changed = false
      const next = new Set<string>()
      prev.forEach((id) => {
        if (valid.has(id)) next.add(id)
        else changed = true
      })
      if (next.size !== prev.size) changed = true
      return changed ? next : prev
    })
  }, [list])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id))
      } else {
        visibleIds.forEach((id) => next.add(id))
      }
      return next
    })
  }, [allVisibleSelected, visibleIds])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  const handleBulkExport = useCallback(() => {
    if (selectedIds.size === 0) return
    const selected = list.filter((i) => selectedIds.has(i.id))
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `datamod-saved-insights-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('JSON 파일로 저장했습니다.')
  }, [list, selectedIds])

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`선택한 ${selectedIds.size}개 인사이트를 삭제할까요?`)) return
    const ids = [...selectedIds]
    setBulkWorking(true)
    let ok = 0
    const deleted = new Set<string>()
    try {
      for (const id of ids) {
        const res = await fetch(`/api/insights/${id}`, { method: 'DELETE' })
        if (res.ok) {
          ok += 1
          deleted.add(id)
          setList((prev) => prev.filter((i) => i.id !== id))
        }
      }
      setSelectedIds((prev) => {
        const next = new Set(prev)
        deleted.forEach((id) => next.delete(id))
        return next
      })
      if (ok === ids.length) toast.success(`${ok}건을 삭제했습니다.`)
      else if (ok > 0) toast.warning(`${ok}/${ids.length}건만 삭제되었습니다.`)
      else toast.error('삭제에 실패했습니다.')
    } finally {
      setBulkWorking(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 인사이트를 삭제할까요?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/insights/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setList((prev) => prev.filter((i) => i.id !== id))
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
      <div className="rin-page min-h-[60vh]">
        <header className="rin-page-header">
          <h1 className="rin-page-title">저장한 인사이트</h1>
          <p className="rin-page-subtitle">
            찜한 분석 스냅샷을 시장별로 모아 보고, 필요할 때 보내거나 정리하세요.
          </p>
        </header>
        <LoadingState
          message="인사이트 목록을 불러오는 중"
          detail="잠시만 기다려 주세요."
          size="lg"
          className="py-8"
        />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rin-page min-h-[40vh]">
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

  return (
    <div className="rin-page">
      <header className="rin-page-header">
        <h1 className="rin-page-title">저장한 인사이트</h1>
        <p className="rin-page-subtitle">
          찜한 분석 스냅샷을 시장별로 모아 보고, 필요할 때 보내거나 정리하세요.
        </p>
      </header>

      {list.length > 0 && (
        <div className="rin-pro-card mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="이름·키워드·요약으로 검색"
              className="h-11 rounded-xl border-[#E8EAED] bg-[#F8F9FA] pl-10 text-sm placeholder:text-muted-foreground"
              aria-label="인사이트 검색"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-xs font-semibold text-muted-foreground">시장</span>
            <button
              type="button"
              onClick={() => setMarketFilter('all')}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                marketFilter === 'all'
                  ? 'border-[#2AC1BC] bg-[#E8FAF9] text-[#222]'
                  : 'border-border bg-white text-muted-foreground hover:border-[#2AC1BC]/50'
              )}
            >
              전체
            </button>
            {marketCodes.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setMarketFilter(code)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  marketFilter === code
                    ? 'border-[#2AC1BC] bg-[#E8FAF9] text-[#222]'
                    : 'border-border bg-white text-muted-foreground hover:border-[#2AC1BC]/50'
                )}
              >
                {COUNTRY_LABELS[code] ?? code}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#222]">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAllVisible}
                disabled={visibleIds.length === 0}
                className="h-4 w-4 rounded border-[#E8EAED] text-[#2AC1BC] focus:ring-[#2AC1BC]"
              />
              화면에 보이는 항목 전체 선택
            </label>
            {selectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{selectedIds.size}개 선택됨</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 border-[#2AC1BC]/40 font-semibold text-[#0f766e] hover:bg-[#E8FAF9]"
                  onClick={handleBulkExport}
                  disabled={bulkWorking}
                >
                  <Download className="h-4 w-4" />
                  JSON보내기
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 border-[#FF5F5F]/40 font-semibold text-[#FF5F5F] hover:bg-red-50"
                  onClick={handleBulkDelete}
                  disabled={bulkWorking}
                >
                  {bulkWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  선택 삭제
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-9" onClick={clearSelection}>
                  선택 해제
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rin-empty-container flex flex-col items-center">
          <SavedInsightsEmptyIllustration className="mb-2 h-40 w-48 max-w-full" />
          <EmptyState
            title="아직 저장된 인사이트가 없습니다"
            description="결과 페이지에서 인사이트를 저장하면 이곳에 모아 다시 열람할 수 있습니다. 시장 분석을 실행한 뒤 마음에 드는 요약을 저장해 보세요."
            action={
              <Link href="/">
                <Button variant="default" size="lg" className="gap-2">
                  <Search className="h-4 w-4" />
                  시장 분석 시작하기
                </Button>
              </Link>
            }
          />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="rin-pro-card py-10 text-center">
          <p className="text-sm text-muted-foreground mb-4">검색·시장 필터에 맞는 인사이트가 없습니다.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="font-semibold"
            onClick={() => {
              setFilter('')
              setMarketFilter('all')
            }}
          >
            필터 초기화
          </Button>
        </div>
      ) : (
        <ul className="m-0 grid max-w-full min-w-0 list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {filteredList.map((item) => {
            const keyword = item.snapshot?.keyword ?? ''
            const country = item.snapshot?.countryCode ?? 'KR'
            const resultsHref = `/results?keyword=${encodeURIComponent(keyword)}&country=${encodeURIComponent(country)}`
            const countryLabel = COUNTRY_LABELS[country] ?? country
            return (
              <li key={item.id} className="min-w-0">
                <InsightCard
                  item={item}
                  resultsHref={resultsHref}
                  countryLabel={countryLabel}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={toggleSelect}
                />
              </li>
            )
          })}
        </ul>
      )}

      {filteredList.length > 0 && (
        <p className="text-sm text-muted-foreground mt-8">
          {filter.trim() || marketFilter !== 'all'
            ? `표시 중 ${filteredList.length}건 (전체 ${list.length}건)`
            : `총 ${list.length}건`}
        </p>
      )}
    </div>
  )
}
