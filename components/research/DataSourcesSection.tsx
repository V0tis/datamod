'use client'

import { Database, TrendingUp, MessageCircle, Rocket, Wallet, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DataSourceConfidence = 'high' | 'medium' | 'low'

export interface DataSourceSignal {
  id: string
  source: string
  summary: string
  confidence: DataSourceConfidence
  icon?: React.ReactNode
  /** true = 실제 분석에 사용됨, false = 미통합(Preview) */
  usedInAnalysis?: boolean
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  '구글 트렌드': <TrendingUp className="h-4 w-4" />,
  'Serper 웹 검색': <Search className="h-4 w-4" />,
  '스타트업 투자 데이터': <Wallet className="h-4 w-4" />,
  'Google Trends': <TrendingUp className="h-4 w-4" />,
  'Reddit discussions': <MessageCircle className="h-4 w-4" />,
  'Product Hunt launches': <Rocket className="h-4 w-4" />,
  'VC funding data': <Wallet className="h-4 w-4" />,
}

function confidenceLabel(c: DataSourceConfidence): string {
  switch (c) {
    case 'high':
      return '높음'
    case 'medium':
      return '중간'
    case 'low':
      return '낮음'
    default:
      return '—'
  }
}

function confidenceColor(c: DataSourceConfidence): string {
  switch (c) {
    case 'high':
      return 'bg-emerald-500/20 text-emerald-700 '
    case 'medium':
      return 'bg-amber-500/20 text-amber-700 '
    case 'low':
      return 'bg-muted text-muted-foreground'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export interface DataSourcesSectionProps {
  signals: DataSourceSignal[]
  loading?: boolean
  className?: string
}

export function DataSourcesSection({
  signals,
  loading = false,
  className,
}: DataSourcesSectionProps) {
  if (loading && signals.length === 0) {
    return (
      <section
        className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
        aria-label="데이터 출처"
      >
        <div className="p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-primary" />
            데이터 출처
          </h2>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  if (signals.length === 0) return null

  const used = signals.filter((s) => s.usedInAnalysis !== false)
  const preview = signals.filter((s) => s.usedInAnalysis === false)

  const renderList = (list: DataSourceSignal[], title: string) => (
    <div className="space-y-2">
      <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      <ul className="space-y-2">
        {list.map((sig) => (
          <li key={sig.id} className="rounded-lg border border-border/60 bg-muted/20 p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {sig.icon ?? SOURCE_ICONS[sig.source]}
                {sig.source}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                  confidenceColor(sig.confidence)
                )}
                title={`신뢰도: ${confidenceLabel(sig.confidence)} - 시장 신호 강도·일관성 반영`}
              >
                {confidenceLabel(sig.confidence)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{sig.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <section
      className={cn('rounded-xl border border-border bg-card shadow-sm overflow-hidden', className)}
      aria-label="데이터 출처"
    >
      <div className="p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-primary" />
          데이터 출처
        </h2>
        <div className="space-y-6">
          {used.length > 0 && renderList(used, '분석에 사용된 소스')}
          {preview.length > 0 && renderList(preview, '참고 소스 (본 분석에 미통합)')}
        </div>
        <p className="text-[11px] text-muted-foreground mt-4 pt-4 border-t border-border/60">
          신뢰도는 감지된 시장 신호의 강도·일관성을 나타냅니다. 높음: 강한 신호, 중간: 부분적 반영, 낮음: 미사용 또는 제한적.
        </p>
      </div>
    </section>
  )
}
