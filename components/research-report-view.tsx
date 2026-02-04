'use client'

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

/**
 * Single shape for AI result and DB content (reports.content).
 * Keeps result page and detail page UI in sync.
 */
export interface ResearchContent {
  marketNews?: string[]
  painPoints?: string[]
  competitorTrends?: string
  sentiment?: number
}

function normalizeContent(raw: ResearchContent | null | undefined): ResearchContent {
  if (!raw) {
    return { marketNews: [], painPoints: [], competitorTrends: '', sentiment: 0 }
  }
  return {
    marketNews: Array.isArray(raw.marketNews) ? raw.marketNews : [],
    painPoints: Array.isArray(raw.painPoints) ? raw.painPoints : [],
    competitorTrends: typeof raw.competitorTrends === 'string' ? raw.competitorTrends : '',
    sentiment:
      typeof raw.sentiment === 'number'
        ? Math.min(100, Math.max(0, raw.sentiment))
        : 0,
  }
}

export interface ResearchReportViewProps {
  keyword: string
  content: ResearchContent
  /** When set, show "saved" banner and link to history */
  reportId?: string | null
  /** When true and no reportId, show login CTA (for fresh search result) */
  showLoginCta?: boolean
  /** Callback URL for login redirect */
  loginCallbackUrl?: string
}

export function ResearchReportView({
  keyword,
  content,
  reportId = null,
  showLoginCta = false,
  loginCallbackUrl,
}: ResearchReportViewProps) {
  const { marketNews, painPoints, competitorTrends, sentiment } = normalizeContent(content)

  return (
    <main className="min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-8">
      {/* 저장 완료 또는 로그인 유도 (결과 페이지에서만) */}
      {reportId ? (
        <div className="rounded-lg bg-primary/10 border border-primary/20 text-primary px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">리포트가 내 기록에 저장되었습니다.</span>
          <Link href={`/results/${reportId}`}>
            <Button size="sm" variant="secondary" className="rounded-full">
              내 기록에서 보기
            </Button>
          </Link>
        </div>
      ) : showLoginCta ? (
        <div className="rounded-lg bg-muted border border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            로그인하면 이 리포트를 내 기록에 저장할 수 있어요.
          </p>
          <Link
            href={
              loginCallbackUrl
                ? `/auth/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`
                : '/auth/login'
            }
          >
            <Button size="sm" className="rounded-full">
              로그인하고 저장하기
            </Button>
          </Link>
        </div>
      ) : null}

      <header className="flex flex-wrap justify-between items-center gap-4">
        <h1 className="text-3xl font-bold font-serif">
          &quot;{keyword}&quot; 리서치 리포트
        </h1>
        <Badge variant="outline" className="text-sm">Verified by Rin-AI</Badge>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>📰 시장 뉴스 요약</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2">
              {marketNews.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {marketNews.length === 0 && (
                <li className="text-muted-foreground">수집된 뉴스가 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>😫 유저 페인 포인트</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 space-y-2 text-red-600 dark:text-red-400">
              {painPoints.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {painPoints.length === 0 && (
                <li className="text-muted-foreground">수집된 페인 포인트가 없습니다.</li>
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🚀 경쟁사 동향</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{competitorTrends || '수집된 경쟁사 동향이 없습니다.'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌡️ 유저 반응 (긍정 점수)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-yellow-500">{sentiment}%</div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 h-4 rounded-full mt-4 overflow-hidden">
              <div
                className="bg-yellow-500 h-4 rounded-full transition-[width] duration-500"
                style={{ width: `${Math.min(100, Math.max(0, sentiment))}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="pt-4 flex gap-2">
        <Link href="/history">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="mr-2 size-4" />
            히스토리
          </Button>
        </Link>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            새 검색
          </Button>
        </Link>
      </div>
    </main>
  )
}
