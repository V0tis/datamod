'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Bookmark } from 'lucide-react'
import { COUNTRY_LABELS } from '@/components/country-chips'
import { InsightCard } from '@/components/insights/InsightCard'
import type { SavedInsight } from '@/lib/insights-types'

export default function InsightsPage() {
  const [list, setList] = useState<SavedInsight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const filteredList = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return list
    return list.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(q)
      const keywordMatch = item.snapshot?.keyword?.toLowerCase().includes(q)
      const noteMatch = item.note?.toLowerCase().includes(q)
      const summaryMatch = (item.snapshot?.summary ?? item.snapshot?.strategicSummary?.summary ?? '')
        .toLowerCase()
        .includes(q)
      return nameMatch || keywordMatch || noteMatch || summaryMatch
    })
  }, [list, filter])

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
      <div className="rin-page rin-page-narrow min-h-[60vh]">
        <header className="rin-page-header">
          <h1 className="rin-page-title text-xl">
            과거 결정과 신호
          </h1>
          <p className="rin-page-subtitle text-sm mt-1">
            저장한 분석 스냅샷 — 당시의 판단 근거를 되짚어 봅니다.
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
      <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[40vh] bg-background">
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
    <div className="rin-page rin-page-narrow">
      <header className="rin-page-header">
        <h1 className="rin-page-title text-xl">
          과거 결정과 신호
        </h1>
        <p className="rin-page-subtitle text-sm mt-1">
          저장한 분석 스냅샷 — 당시의 판단 근거를 되짚어 봅니다.
        </p>
      </header>

      {list.length > 0 && (
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="이름·키워드·요약으로 검색"
              className="pl-9 h-9 text-sm border-border/60 bg-background placeholder:text-muted-foreground"
              aria-label="인사이트 검색"
            />
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rin-empty-container">
          <EmptyState
            title="저장한 인사이트가 없습니다"
            description="결과 페이지에서 북마크한 인사이트가 여기에 모입니다. 시장 분석을 시작하고 유의미한 인사이트를 저장해 보세요."
            icon={<Bookmark className="h-12 w-12 text-primary/70" strokeWidth={1.5} />}
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
      ) : filteredList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          검색어에 맞는 인사이트가 없습니다.
        </p>
      ) : (
        <ul className="space-y-4 list-none p-0 m-0">
          {filteredList.map((item) => {
            const keyword = item.snapshot?.keyword ?? ''
            const country = item.snapshot?.countryCode ?? 'KR'
            const resultsHref = `/results?keyword=${encodeURIComponent(keyword)}&country=${encodeURIComponent(country)}`
            const countryLabel = COUNTRY_LABELS[country] ?? country
            return (
              <li key={item.id}>
                <InsightCard
                  item={item}
                  resultsHref={resultsHref}
                  countryLabel={countryLabel}
                  onDelete={handleDelete}
                  deletingId={deletingId}
                />
              </li>
            )
          })}
        </ul>
      )}

      {filteredList.length > 0 && (
        <p className="text-sm text-muted-foreground mt-6">
          {filter ? `검색 결과 ${filteredList.length}건` : `총 ${list.length}건`}
        </p>
      )}
    </div>
  )
}
