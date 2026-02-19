'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Bookmark, Search, FileText, Trash2, Loader2 } from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
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
      return nameMatch || keywordMatch || noteMatch
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
      <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[60vh] bg-background">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" />
            저장한 인사이트
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            분석 결과를 인사이트로 저장해 두었다가 나중에 다시 볼 수 있습니다.
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
          onRecovery={() => { setError(null); fetchList() }}
          detail={error}
        />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-screen bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-primary" />
          저장한 인사이트
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          분석 결과를 인사이트로 저장해 두었다가 나중에 다시 볼 수 있습니다.
        </p>
      </header>

      {list.length > 0 && (
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="이름·키워드·메모로 검색"
              className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground"
              aria-label="인사이트 검색"
            />
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <Card className="border border-border bg-card shadow-sm max-w-md w-full mx-auto">
          <CardContent className="p-6">
            <EmptyState
              title="저장한 인사이트가 없습니다"
              description="결과 페이지에서 '인사이트로 저장'을 누르면 여기에 쌓입니다."
              icon={<Bookmark className="w-12 h-12 text-muted-foreground" />}
              action={
                <Link href="/">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Search className="w-4 h-4" />
                    검색하러 가기
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
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
            const summary = (item.snapshot?.summary ?? item.snapshot?.strategicSummary?.summary ?? '').trim()
            const summarySnippet = summary ? (summary.slice(0, 120) + (summary.length > 120 ? '…' : '')) : null
            return (
              <li key={item.id}>
                <Card className="border border-border/60 bg-card/50 transition-colors hover:bg-muted/10">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <Link
                        href={resultsHref}
                        className="flex-1 min-w-0 rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <h3 className="text-base font-semibold text-foreground break-words">{item.name}</h3>
                        {item.note && (
                          <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2" title="저장 이유">
                            {item.note.slice(0, 100)}{item.note.length > 100 ? '…' : ''}
                          </p>
                        )}
                        {summarySnippet && (
                          <p className="text-sm text-foreground/80 mt-1 line-clamp-2">
                            {summarySnippet}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-2 text-[11px] text-muted-foreground">
                          {keyword && <span>시장 맥락: {keyword}</span>}
                          {keyword && <span>·</span>}
                          <TimeAgo isoString={item.created_at} />
                        </div>
                      </Link>
                      <div className="flex gap-2 shrink-0">
                        <Link href={resultsHref}>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <FileText className="w-4 h-4" />
                            결과 보기
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                          disabled={deletingId === item.id}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          aria-label="인사이트 삭제"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}

      {filteredList.length > 0 && (
        <p className="text-center text-sm text-muted-foreground mt-6">
          {filter ? `검색 결과 ${filteredList.length}건` : `총 ${list.length}건`}
        </p>
      )}
    </div>
  )
}
