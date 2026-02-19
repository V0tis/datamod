'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Trash2, Loader2 } from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
import { COUNTRY_LABELS } from '@/components/country-chips'
import type { SavedInsight } from '@/lib/insights-types'

/** Type indicators from snapshot: strategicSummary content maps to PM framework labels. */
function InsightTypeBadges({ item }: { item: SavedInsight }) {
  const ss = item.snapshot?.strategicSummary
  const hasSummary = Boolean(ss?.summary?.trim())
  const hasOpportunity = Boolean(ss?.opportunity?.trim())
  const hasThreat = Boolean(ss?.threat?.trim())
  const hasAction = Array.isArray(ss?.actionItems) && ss.actionItems.length > 0
  const badges: string[] = []
  if (hasSummary) badges.push('요약')
  if (hasOpportunity || hasThreat) badges.push('가설')
  if (hasAction) badges.push('추론')
  if (badges.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span
          key={b}
          className="text-[11px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 font-medium"
          aria-label={`유형: ${b}`}
        >
          {b}
        </span>
      ))}
    </span>
  )
}

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
      <div className="p-6 md:p-8 max-w-2xl mx-auto min-h-[60vh] bg-background">
        <header className="mb-8">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            과거 결정과 신호
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
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
          onRecovery={() => { setError(null); fetchList() }}
          detail={error}
        />
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
              placeholder="이름·키워드·메모로 검색"
              className="pl-9 h-9 text-sm border-border/60 bg-background placeholder:text-muted-foreground"
              aria-label="인사이트 검색"
            />
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-lg border border-border/60 bg-background/50 py-12 px-6 text-center">
          <EmptyState
            title="저장한 인사이트가 없습니다"
            description="결과 페이지에서 인사이트를 저장하면 여기에 쌓입니다."
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
      ) : filteredList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          검색어에 맞는 인사이트가 없습니다.
        </p>
      ) : (
        <ul className="space-y-1 list-none p-0 m-0">
          {filteredList.map((item) => {
            const keyword = item.snapshot?.keyword ?? ''
            const country = item.snapshot?.countryCode ?? 'KR'
            const resultsHref = `/results?keyword=${encodeURIComponent(keyword)}&country=${encodeURIComponent(country)}`
            const summary = (item.snapshot?.summary ?? item.snapshot?.strategicSummary?.summary ?? '').trim()
            const explanation = (item.snapshot?.qualityScore?.explanation ?? '').trim()
            const score = item.snapshot?.qualityScore
            const summarySnippet = summary ? (summary.slice(0, 140) + (summary.length > 140 ? '…' : '')) : null
            return (
              <li key={item.id}>
                <article
                  className="group rounded-lg border border-border/50 bg-background py-4 px-4 sm:px-5 transition-colors hover:border-border hover:bg-muted/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      href={resultsHref}
                      className="flex-1 min-w-0 rounded focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      {/* Analysis target: keyword + country. Primary context. */}
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-medium text-foreground break-words">{item.name}</h3>
                        <span
                          className="text-[11px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 shrink-0"
                          title="분석 대상 시장"
                        >
                          {keyword || '—'} · {COUNTRY_LABELS[country] ?? country}
                        </span>
                      </div>
                      {/* Market signal: score + label + short explanation. Always visible. */}
                      {score && (
                        <div className="mt-2 space-y-0.5">
                          <span className="text-sm text-muted-foreground">
                            시장 신호 <span className="font-medium text-foreground">{score.score}/100</span>
                            {score.label && <span className="ml-1">· {score.label}</span>}
                          </span>
                          {explanation && (
                            <p className="text-sm text-muted-foreground line-clamp-2" title={explanation}>
                              {explanation.slice(0, 100)}{explanation.length > 100 ? '…' : ''}
                            </p>
                          )}
                        </div>
                      )}
                      {/* Summary: one-line conclusion. */}
                      {summarySnippet && (
                        <p className="mt-2 text-sm text-foreground/85 line-clamp-2">{summarySnippet}</p>
                      )}
                      {/* Type indicators: 요약 / 가설 / 추론. Subtle labels. */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <InsightTypeBadges item={item} />
                        {item.note && (
                          <span className="text-[11px] text-muted-foreground line-clamp-1" title={item.note}>
                            {item.note.slice(0, 50)}{item.note.length > 50 ? '…' : ''}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          <TimeAgo isoString={item.created_at} />
                        </span>
                      </div>
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
                          handleDelete(item.id)
                        }}
                        disabled={deletingId === item.id}
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
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
                </article>
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
