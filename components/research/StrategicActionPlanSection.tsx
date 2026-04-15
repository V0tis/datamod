'use client'

import { ListOrdered, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StrategicActionPlanData = {
  roadmap_priorities?: Array<{ title: string; rationale?: string; priority_rank?: number }>
  okr_key_results?: Array<{ objective?: string; key_results?: string[] }>
}

export function StrategicActionPlanSection({
  pmPlanningSummary,
  plan,
  className,
}: {
  pmPlanningSummary?: string
  plan?: StrategicActionPlanData | null
  className?: string
}) {
  const priorities = plan?.roadmap_priorities?.filter((p) => p.title?.trim()) ?? []
  const okrs = plan?.okr_key_results?.filter((o) => (o.objective?.trim() || o.key_results?.length)) ?? []
  if (!pmPlanningSummary?.trim() && priorities.length === 0 && okrs.length === 0) return null

  return (
    <section
      className={cn(
        'rounded-xl border border-border/60 bg-card/80 overflow-hidden',
        className
      )}
      aria-label="Strategic Action Plan"
    >
      <div className="px-4 sm:px-5 py-4 border-b border-border/60">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
          <ListOrdered className="h-5 w-5 text-primary" />
          Strategic Action Plan
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          경쟁 구도를 바탕으로 한 차기 로드맵 우선순위와 OKR 핵심 지표 제안
        </p>
      </div>
      <div className="px-4 sm:px-5 py-4 space-y-5">
        {pmPlanningSummary?.trim() ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5">
            <p className="text-[11px] font-medium text-primary uppercase tracking-wide mb-1">PM 기획 근거</p>
            <p className="text-sm text-foreground/95 leading-relaxed whitespace-pre-wrap">{pmPlanningSummary.trim()}</p>
          </div>
        ) : null}

        {priorities.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              차기 제품 로드맵 우선순위
            </p>
            <ol className="space-y-2.5 list-decimal list-inside marker:text-muted-foreground text-sm">
              {[...priorities]
                .sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99))
                .map((p, i) => (
                  <li key={`${p.title}-${i}`} className="leading-relaxed pl-0.5">
                    <span className="font-medium text-foreground">{p.title}</span>
                    {p.rationale ? (
                      <span className="block text-muted-foreground text-xs mt-0.5 pl-0">{p.rationale}</span>
                    ) : null}
                  </li>
                ))}
            </ol>
          </div>
        ) : null}

        {okrs.length > 0 ? (
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              관련 OKR · 핵심 결과(KR)
            </p>
            <div className="space-y-4">
              {okrs.map((block, i) => (
                <div key={i} className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2.5">
                  {block.objective?.trim() ? (
                    <p className="text-sm font-medium text-foreground mb-1.5">{block.objective.trim()}</p>
                  ) : null}
                  {Array.isArray(block.key_results) && block.key_results.length > 0 ? (
                    <ul className="list-disc list-inside space-y-1 text-xs text-foreground/90">
                      {block.key_results.map((kr, j) => (
                        <li key={j} className="leading-relaxed">
                          {kr}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">KR을 DATA에 맞춰 구체화하세요.</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
