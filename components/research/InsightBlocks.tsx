'use client'

import { Check, Info, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

const LABELS_KO = { fact: '관찰', hypothesis: '가설', inference: '해석' }
const LABELS_EN = { fact: 'Fact', hypothesis: 'Hypothesis', inference: 'Inference' }

export interface InsightBlocksProps {
  facts?: string[]
  hypotheses?: string[]
  inferences?: string[]
  className?: string
  /** Max items per block for "Top N" display */
  maxItems?: number
  loading?: boolean
  labels?: 'ko' | 'en'
}

/** Structured insight blocks: [관찰], [가설], [해석]. PM-ready hierarchy. */
export function InsightBlocks({
  facts = [],
  hypotheses = [],
  inferences = [],
  className,
  maxItems,
  loading = false,
  labels = 'en',
}: InsightBlocksProps) {
  const L = labels === 'ko' ? LABELS_KO : LABELS_EN
  const take = (arr: string[]) => (typeof maxItems === 'number' ? arr.slice(0, maxItems) : arr)
  const f = take(facts)
  const h = take(hypotheses)
  const i = take(inferences)
  const hasAny = f.length > 0 || h.length > 0 || i.length > 0
  if (loading && !hasAny) {
    return (
      <section className={cn('space-y-4', className)} aria-label="Insights">
        <div>
          <div className="h-3.5 w-20 rounded bg-muted/60 animate-pulse mb-2" />
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-4 w-full rounded bg-muted/40 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    )
  }
  if (!hasAny) return null

  return (
    <section className={cn('space-y-4', className)} aria-label="Insights">
      {f.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" aria-hidden />
            {L.fact}
          </h3>
          <ul className="space-y-2 list-none pl-0">
            {f.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-sm text-foreground leading-relaxed">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {h.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" aria-hidden />
            {L.hypothesis}
          </h3>
          <ul className="space-y-2 list-none pl-0">
            {h.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-sm leading-relaxed">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500/70" aria-hidden />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {i.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" aria-hidden />
            {L.inference}
          </h3>
          <ul className="space-y-2 list-none pl-0">
            {i.map((item, idx) => (
              <li key={idx} className="flex gap-2 text-sm leading-relaxed">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-violet-500/70" aria-hidden />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
