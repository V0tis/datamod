'use client'

import { cn } from '@/lib/utils'

/** Cognitive layer for PM clarity: fact = sourced/data, hypothesis = AI interpretation, assumption = recommendation. */
export type CognitiveLayer = 'fact' | 'hypothesis' | 'assumption'

const LAYER_LABELS: Record<CognitiveLayer, string> = {
  fact: '사실',
  hypothesis: '해석',
  assumption: '가정',
}

/**
 * Subtle label to distinguish certainty levels of analysis content.
 * Inferred from section structure; no content changes. Theme tokens only.
 */
export function CognitiveLayerLabel({
  layer,
  className,
}: {
  layer: CognitiveLayer
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-[10px] font-medium uppercase tracking-widest text-muted-foreground',
        className
      )}
      aria-label={`인지 계층: ${LAYER_LABELS[layer]}`}
    >
      {LAYER_LABELS[layer]}
    </span>
  )
}
