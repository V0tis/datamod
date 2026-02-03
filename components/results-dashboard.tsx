'use client'

import { Button } from '@/components/ui/button'

export interface ResearchSource {
  type: 'news' | 'community' | 'data'
  title: string
  snippet: string
  url?: string
  publishedAt?: string
}

export interface ResearchResponse {
  success: boolean
  query: string
  sources: ResearchSource[]
  summary?: string
  error?: string
}

interface ResultsDashboardProps {
  results: ResearchResponse
  onSearchAgain: () => void
}

const sourceLabels: Record<ResearchSource['type'], string> = {
  news: '📰 시장 뉴스',
  community: '💬 커뮤니티 반응',
  data: '📊 데이터 신선도',
}

export function ResultsDashboard({ results, onSearchAgain }: ResultsDashboardProps) {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐕</span>
            <h1 className="font-semibold text-foreground">Rin-AI</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSearchAgain}
            className="rounded-full"
          >
            새 검색
          </Button>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-foreground">
            &quot;{results.query}&quot; 검색 결과
          </h2>
          {results.summary && (
            <p className="mt-2 text-muted-foreground">{results.summary}</p>
          )}
        </div>

        {/* Sources Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {results.sources.map((source, index) => (
            <div
              key={index}
              className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {sourceLabels[source.type]}
              </p>
              <h3 className="mb-2 font-semibold text-foreground">{source.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {source.snippet}
              </p>
              {source.url && (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm text-primary hover:underline"
                >
                  자세히 보기 →
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 flex justify-center">
          <Button
            variant="default"
            onClick={onSearchAgain}
            className="rounded-full px-8"
          >
            다른 키워드로 검색
          </Button>
        </div>
      </div>
    </main>
  )
}
