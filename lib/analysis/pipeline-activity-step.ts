/**
 * 스트리밍/태스크 키 → 타임라인 단계 인덱스(0–7). done/캐시 등은 null.
 */
export function streamTaskToStageIndex(task: string | undefined): number | null {
  if (!task) return null
  const t = task
  const m: Record<string, number> = {
    signal_layer: 0,
    news: 0,
    article_extraction: 0,
    article_summary: 0,
    trend_analysis: 1,
    pass1: 1,
    competition_analysis: 2,
    insight_extraction: 3,
    strategy_generation: 4,
    execution_layer: 5,
    pass2: 5,
    creative: 5,
    risk_opportunity: 6,
    risks_opportunities: 6,
    post_processing: 7,
    post_processing_key_metrics: 7,
    post_processing_creative: 7,
    post_processing_saving: 7,
    final_refining: 7,
    done: 8,
  }
  return m[t] ?? null
}

/** 로그 행에 저장할 정규화된 step 키 (태스크 이름과 동일) */
export function normalizeActivityStepId(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw === '__global__') return '__global__'
  const idx = streamTaskToStageIndex(raw)
  if (idx === null) return raw
  const byIndex = [
    'signal_layer',
    'trend_analysis',
    'competition_analysis',
    'insight_extraction',
    'strategy_generation',
    'execution_layer',
    'risk_opportunity',
    'post_processing',
  ] as const
  return byIndex[idx] ?? raw
}
