'use client'

import { cn } from '@/lib/utils'

/** AI trust layer: fact = verifiable, hypothesis = reasoned assumption, assumption = AI interpretation. */
export type CognitiveLayer = 'fact' | 'hypothesis' | 'assumption'

const LAYER_LABELS: Record<CognitiveLayer, string> = {
  fact: '사실',
  hypothesis: '가설',
  assumption: '추정',
}

/**
 * Trust layer label with typographic hierarchy.
 * FACT: strongest contrast (verifiable data)
 * HYPOTHESIS: muted (reasoned assumptions)
 * INFERENCE/assumption: most muted + "AI 해석" hint
 * No badges/icons; scannable at a glance.
 */
export function CognitiveLayerLabel({
  layer,
  className,
}: {
  layer: CognitiveLayer
  className?: string
}) {
  const base = 'text-[10px] font-medium uppercase tracking-widest'
  const variants: Record<CognitiveLayer, string> = {
    fact: 'text-foreground font-semibold',
    hypothesis: 'text-muted-foreground',
    assumption: 'text-muted-foreground/80',
  }
  return (
    <span
      className={cn(base, variants[layer], className)}
      aria-label={`인지 계층: ${LAYER_LABELS[layer]}${layer === 'assumption' ? ' (AI 해석)' : ''}`}
    >
      {LAYER_LABELS[layer]}
      {layer === 'assumption' && <span className="ml-1 text-[9px] normal-case tracking-normal opacity-80">· AI 해석</span>}
    </span>
  )
}
