'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Search, ArrowLeft, Newspaper, MessageCircle, BarChart3 } from 'lucide-react'

interface ResearchSource {
  type: 'news' | 'community' | 'data'
  title: string
  snippet: string
  url?: string
  publishedAt?: string
}

interface ResearchResponse {
  success: boolean
  query: string
  sources: ResearchSource[]
  summary?: string
  error?: string
}

const sourceConfig = {
  news: {
    icon: Newspaper,
    label: '시장 뉴스',
    color: 'text-blue-600',
    bgColor: 'bg-blue-500/10',
  },
  community: {
    icon: MessageCircle,
    label: '커뮤니티 반응',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-500/10',
  },
  data: {
    icon: BarChart3,
    label: '데이터 신선도',
    color: 'text-violet-600',
    bgColor: 'bg-violet-500/10',
  },
} as const

export default function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>
}) {
  const [data, setData] = useState<ResearchResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function load() {
      const params = await searchParams
      const q = params?.query?.trim()

      if (!q) {
        setLoading(false)
        setError('검색어가 없습니다.')
        return
      }

      try {
        const res = await fetch(`/api/research?query=${encodeURIComponent(q)}`)
        const json: ResearchResponse = await res.json()

        if (!mounted) return

        if (!res.ok) {
          setError(json.error ?? '리서치를 불러오는데 실패했습니다.')
          return
        }

        setData(json)
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [searchParams])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">리서치 결과를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background px-4">
        <p className="text-destructive">{error}</p>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 size-4" />
            검색으로 돌아가기
          </Button>
        </Link>
      </div>
    )
  }

  const newsCount = data.sources.filter((s) => s.type === 'news').length
  const communityCount = data.sources.filter((s) => s.type === 'community').length
  const dataCount = data.sources.filter((s) => s.type === 'data').length

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center gap-4 px-4 md:px-6">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="size-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Rin-AI 대시보드</h1>
            <p className="text-sm text-muted-foreground">
              &quot;{data.query}&quot; 검색 결과
            </p>
          </div>
          <Link href="/">
            <Button className="rounded-full">
              <Search className="mr-2 size-4" />
              새 검색
            </Button>
          </Link>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="container px-4 py-8 md:px-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                뉴스 소스
              </CardTitle>
              <Newspaper className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{newsCount}</div>
              <p className="text-xs text-muted-foreground">
                시장 뉴스 수집 완료
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                커뮤니티 반응
              </CardTitle>
              <MessageCircle className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{communityCount}</div>
              <p className="text-xs text-muted-foreground">
                유저 반응 수집 완료
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                데이터 검증
              </CardTitle>
              <BarChart3 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dataCount}</div>
              <p className="text-xs text-muted-foreground">
                신선도 검증 완료
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        {data.summary && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>요약</CardTitle>
              <CardDescription>{data.summary}</CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Source Cards */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">수집된 소스</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.sources.map((source, index) => {
              const config = sourceConfig[source.type]
              const Icon = config.icon
              return (
                <Card
                  key={index}
                  className="overflow-hidden transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-2">
                    <div
                      className={`mb-2 inline-flex size-10 items-center justify-center rounded-lg ${config.bgColor} ${config.color}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <CardTitle className="text-base">{source.title}</CardTitle>
                    <CardDescription className="text-xs uppercase tracking-wider">
                      {config.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {source.snippet}
                    </p>
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                      >
                        자세히 보기 →
                      </a>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
