'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
      <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-[60vh] bg-[#F9FAFB] dark:bg-[#0f1113]">
        <div className="space-y-2 mb-6">
          <div className="h-8 w-48 bg-muted dark:bg-[#1c1e21] rounded animate-pulse" />
          <div className="h-4 w-72 bg-muted dark:bg-[#1c1e21] rounded animate-pulse" />
        </div>
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-card shadow-sm">
          <CardContent className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-muted/30 dark:bg-[#1c1e21] p-6 animate-pulse"
              >
                <div className="h-6 w-32 bg-muted dark:bg-[#2a2d32] rounded mb-2" />
                <div className="h-4 w-full max-w-md bg-muted dark:bg-[#2a2d32] rounded" />
                <div className="h-4 w-24 bg-muted dark:bg-[#2a2d32] rounded mt-2" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center gap-4 min-h-[40vh] bg-[#F9FAFB] dark:bg-[#0f1113]">
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-card shadow-sm max-w-md">
          <CardContent className="p-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); fetchList() }}>
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (records.length === 0) {
    return (
      <div className="p-6 md:p-8 flex flex-col items-center justify-center min-h-[60vh] bg-[#F9FAFB] dark:bg-[#0f1113]">
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-card shadow-sm max-w-md w-full">
          <CardContent className="p-10 text-center">
            <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">기록이 없습니다</h2>
            <p className="text-muted-foreground text-sm mb-6">
              키워드를 검색하면 리서치 결과가 여기에 쌓입니다.
            </p>
            <Link href="/">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Search className="w-4 h-4" />
                메인 검색으로 이동
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto min-h-screen bg-[#F9FAFB] dark:bg-[#0f1113]">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          내 리서치 기록
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          최근 분석한 키워드로 바로 이동해요.
        </p>
      </header>

      <div className="space-y-4">
        {records.map((record) => (
          <Card
            key={record.id}
            className="border border-zinc-200 dark:border-zinc-800 bg-card shadow-sm transition-colors dark:hover:bg-[#1c1e21]"
          >
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <Link
                  href={`/results?keyword=${encodeURIComponent(record.keyword)}${record.country_code ? `&country=${encodeURIComponent(record.country_code)}` : ''}`}
                  className="flex-1 space-y-3 min-w-0 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:focus:ring-offset-[#0f1113]"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="text-lg font-bold text-foreground">{record.keyword}</h3>
                      <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium bg-muted dark:bg-[#1c1e21] text-muted-foreground border border-border dark:border-zinc-700" title="트렌드 채택 국가">
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
