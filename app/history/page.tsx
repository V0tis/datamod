'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/ui/loading-state'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Search, Trash2, FileText, Loader2, History } from 'lucide-react'
import { TimeAgo } from '@/components/time-ago'
import { COUNTRY_LABELS } from '@/components/country-chips'

interface ResearchRecord {
  id: string
  keyword: string
  country_code: string
  report_id: string | null
  updated_at: string | null
  date: string
}

export default function HistoryPage() {
  const [records, setRecords] = useState<ResearchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/research/history')
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
      <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[60vh] bg-background">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            내 리서치 기록
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            최근 분석한 키워드로 바로 이동합니다.
          </p>
        </header>
        <LoadingState
          message="리서치 기록을 불러오는 중입니다"
          detail="잠시만 기다려 주세요."
          size="lg"
          className="py-8"
        />
        <div className="mt-6 space-y-2" aria-hidden>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card/50 p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className="h-5 w-24 bg-muted rounded animate-pulse shrink-0" />
                <span className="h-4 w-16 bg-muted rounded animate-pulse shrink-0" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="h-4 w-20 bg-muted rounded animate-pulse" />
                <span className="h-8 w-8 bg-muted rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[40vh] bg-background">
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
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh] bg-background">
        <Card className="border border-border/60 bg-card/50 max-w-md w-full">
          <CardContent className="p-6">
            <EmptyState
              title="기록이 없습니다"
              description="키워드를 검색하면 리서치 결과가 여기에 쌓입니다. 메인에서 검색해 보세요."
              icon={<History className="w-12 h-12" />}
              action={
                <Link href="/">
                  <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                    <Search className="w-4 h-4" />
                    메인 검색으로 이동
                  </Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-screen bg-background">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          내 리서치 기록
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          최근 분석한 키워드로 바로 이동합니다.
        </p>
      </header>

      <div className="space-y-4">
        {records.map((record) => (
          <Card
            key={record.id}
            className="border border-border/60 bg-card/50 transition-colors hover:bg-muted/10"
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <Link
                  href={`/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`}
                  className="flex-1 space-y-3 min-w-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">{record.keyword}</h3>
                      <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border" title="트렌드 채택 국가">
                        {COUNTRY_LABELS[record.country_code] ?? record.country_code}
                      </span>
                      {record.updated_at && (
                        <TimeAgo isoString={record.updated_at} className="text-xs text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {record.date || '—'}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                  <Link href={`/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`}>
                    <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 w-full sm:w-auto">
                      <FileText className="w-4 h-4" />
                      결과 보기
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault()
                      handleDelete(record.id)
                    }}
                    disabled={deletingId === record.id}
                    className="gap-2 hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                  >
                    {deletingId === record.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    삭제
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground mt-6">
        총 <span className="font-semibold text-foreground">{records.length}</span>건
      </p>
    </div>
  )
}
