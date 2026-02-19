'use client'

import { Check, Info, Brain } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InsightBlocksProps {
  facts?: string[]
  hypotheses?: string[]
  inferences?: string[]
  className?: string
}

/** Structured insight blocks: Fact (neutral), Hypothesis (blue), Inference (purple). */
export function InsightBlocks({
  facts = [],
  hypotheses = [],
  inferences = [],
  className,
}: InsightBlocksProps) {
  const hasAny = facts.length > 0 || hypotheses.length > 0 || inferences.length > 0
  if (!hasAny) return null

  return (
    <section className={cn('space-y-4', className)} aria-label="Insights">
      {facts.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" aria-hidden />
            Fact
          </h3>
          <ul className="space-y-2 list-none pl-0">
            {facts.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground leading-relaxed">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {hypotheses.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" aria-hidden />
            Hypothesis
          </h3>
          <ul className="space-y-2 list-none pl-0">
            {hypotheses.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500/70" aria-hidden />
                <span className="text-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {inferences.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-2 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5" aria-hidden />
            Inference
          </h3>
          <ul className="space-y-2 list-none pl-0">
            {inferences.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
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
