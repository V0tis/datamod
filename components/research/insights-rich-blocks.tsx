'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ListOrdered, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MarkdownBody } from '@/components/ui/markdown-body'

export type InsightsRichBlocksProps = {
  /** 전략적 리스크 — 문자열 또는 마크다운 */
  strategicRisks: string[]
  /** 우선순위 제안 */
  priorityItems: Array<{ title: string; detail?: string }>
  /** 예상 성과 — 자유 텍스트(향후 파이프라인 필드 연동) */
  expectedOutcomes: string[]
  className?: string
}

function BlockShell({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('py-6', className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  )
}

/**
 * 핵심 인사이트 하단: 전략적 리스크 / 우선순위 / 예상 성과 — 데이터 없을 때도 스켈레톤 영역 유지
 */
export function InsightsRichBlocks({
  strategicRisks,
  priorityItems,
  expectedOutcomes,
  className,
}: InsightsRichBlocksProps) {
  const hasRisks = strategicRisks.some((s) => s.trim().length > 0)
  const hasPriority = priorityItems.some((p) => p.title.trim().length > 0)
  const hasOutcomes = expectedOutcomes.some((s) => s.trim().length > 0)

  return (
    <div className={cn('border-t border-border/50', className)}>
      <BlockShell icon={AlertTriangle} title="전략적 리스크" className="border-b border-border/40">
        {hasRisks ? (
          <ul className="space-y-2 text-sm text-foreground">
            {strategicRisks.filter(Boolean).map((line, i) => (
              <li key={i} className="flex gap-2 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/90" aria-hidden />
                <div className="min-w-0 flex-1">
                  <MarkdownBody className="!prose-sm max-w-none leading-relaxed">{line}</MarkdownBody>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            리스크 시그널이 수집되면 이 영역에 표시됩니다.
          </div>
        )}
      </BlockShell>

      <BlockShell icon={ListOrdered} title="우선순위 제안" className="border-b border-border/40">
        {hasPriority ? (
          <ol className="list-decimal space-y-3 pl-5 text-sm marker:text-primary">
            {priorityItems
              .filter((p) => p.title.trim())
              .map((p, i) => (
                <li key={i} className="pl-1 leading-relaxed">
                  <span className="font-medium text-foreground">{p.title}</span>
                  {p.detail?.trim() ? (
                    <p className="mt-1 text-muted-foreground">{p.detail}</p>
                  ) : null}
                </li>
              ))}
          </ol>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            PM 액션·전략 단계 결과가 연결되면 우선 과제가 여기에 정렬됩니다.
          </div>
        )}
      </BlockShell>

      <BlockShell icon={TrendingUp} title="예상 성과">
        {hasOutcomes ? (
          <ul className="space-y-2">
            {expectedOutcomes.filter(Boolean).map((line, i) => (
              <li key={i} className="text-sm leading-relaxed text-foreground">
                <MarkdownBody className="!prose-sm max-w-none">{line}</MarkdownBody>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
            실행·성과 지표는 전략 평가·액션 플랜과 연동해 확장할 수 있습니다.
          </div>
        )}
      </BlockShell>
    </div>
  )
}
