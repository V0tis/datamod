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
import { motion } from 'framer-motion'

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
  /** When true, use compact layout (e.g. inside tabs) */
  embedded?: boolean
}

export function ResearchReportView({
  keyword,
  content,
  reportId = null,
  showLoginCta = false,
  loginCallbackUrl,
  embedded = false,
}: ResearchReportViewProps) {
  const { marketNews, painPoints, competitorTrends, sentiment } = normalizeContent(content)
  const wrapperClass = embedded
    ? 'space-y-6'
    : 'min-h-screen bg-background p-8 max-w-6xl mx-auto space-y-8'

  return (
    <main className={wrapperClass}>
      {/* 저장 완료 또는 로그인 유도 (결과 페이지에서만, embedded 시 생략) */}
      {!embedded && reportId ? (
        <div className="rounded-[20px] bg-primary/10 border border-primary/20 text-primary px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-medium">리포트가 내 기록에 저장되었습니다.</span>
          <Link href={`/results/${reportId}`}>
            <Button size="sm" variant="secondary">
              내 기록에서 보기
            </Button>
          </Link>
        </div>
      ) : !embedded && showLoginCta ? (
        <div className="rounded-[20px] bg-muted border border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            로그인하면 이 리포트를 내 기록에 저장할 수 있습니다.
          </p>
          <Link
            href={
              loginCallbackUrl
                ? `/auth/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`
                : '/auth/login'
            }
          >
            <Button size="sm">
              로그인하고 저장하기
            </Button>
          </Link>
        </div>
      ) : null}

      <header className="flex flex-wrap justify-between items-center gap-4">
        <h1 className={embedded ? 'text-xl font-bold font-serif' : 'text-3xl font-bold font-serif'}>
          &quot;{keyword}&quot; 리서치 리포트
        </h1>
        <Badge variant="outline" className="text-sm">Verified by Rin-AI</Badge>
      </header>

      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 gap-6"
        initial="hidden"
        animate="visible"
        variants={{
          visible: {
            transition: { staggerChildren: 0.08, delayChildren: 0.05 },
          },
          hidden: {},
        }}
      >
        {[
          {
            key: 'news',
            title: '📰 시장 뉴스 요약',
            children: (
              <ul className="list-disc pl-5 space-y-2">
                {(marketNews ?? []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {(marketNews ?? []).length === 0 && (
                  <li className="text-muted-foreground">수집된 뉴스가 없습니다.</li>
                )}
              </ul>
            ),
          },
          {
            key: 'pain',
            title: '😫 유저 페인 포인트',
            children: (
              <ul className="list-disc pl-5 space-y-2 text-red-600 dark:text-red-400">
                {(painPoints ?? []).map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
                {(painPoints ?? []).length === 0 && (
                  <li className="text-muted-foreground">수집된 페인 포인트가 없습니다.</li>
                )}
              </ul>
            ),
          },
          {
            key: 'competitor',
            title: '🚀 경쟁사 동향',
            children: (
              <p className="whitespace-pre-wrap">
                {competitorTrends || '수집된 경쟁사 동향이 없습니다.'}
              </p>
            ),
          },
          {
            key: 'sentiment',
            title: '🌡️ 유저 반응 (긍정 점수)',
            children: (
              <>
                <div className="text-5xl font-bold text-primary">{sentiment}%</div>
                <div className="w-full bg-muted h-4 rounded-full mt-4 overflow-hidden">
                  <div
                    className="bg-primary h-4 rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, sentiment ?? 0))}%` }}
                  />
                </div>
              </>
            ),
          },
        ].map((item) => (
          <motion.div
            key={item.key}
            variants={{
              hidden: { opacity: 0, y: 24 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <Card>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent>{item.children}</CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {!embedded && (
        <div className="pt-4 flex gap-2">
          <Link href="/history">
            <Button variant="outline">
              <ArrowLeft className="mr-2 size-4" />
              히스토리
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline">
              새 검색
            </Button>
          </Link>
        </div>
      )}
    </main>
  )
}
