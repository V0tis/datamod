/**
 * Shared step order and helpers for analysis_tasks ↔ API responses.
 * analysis_id format: `${userId}|${keyword}|${countryCode}`
 */

export const PIPELINE_STEP_ORDER = [
  'signal_layer',
  'trend_analysis',
  'competition_analysis',
  'insight_extraction',
  'strategy_generation',
  'execution_layer',
] as const

export type PipelineTaskRow = {
  step_name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  output_data: unknown
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  provider: string | null
  fallback_used: boolean
  primary_provider_error: string | null
}

export function buildPipelineTasksFromRows(
  rows: Array<Record<string, unknown>> | null | undefined
): PipelineTaskRow[] {
  const byStep = new Map(
    (rows ?? []).map((r) => {
      const step_name = String(r.step_name ?? '')
      return [
        step_name,
        {
          step_name,
          status: (r.status as PipelineTaskRow['status']) ?? 'pending',
          output_data: r.output_data ?? null,
          error_message: (r.error_message as string | null) ?? null,
          started_at: (r.started_at as string | null) ?? null,
          completed_at: (r.completed_at as string | null) ?? null,
          provider: (r.provider as string | null) ?? null,
          fallback_used: Boolean(r.fallback_used),
          primary_provider_error: (r.primary_provider_error as string | null) ?? null,
        } satisfies PipelineTaskRow,
      ]
    })
  )
  return PIPELINE_STEP_ORDER.map((step) => {
    const row = byStep.get(step)
    return (
      row ?? {
        step_name: step,
        status: 'pending' as const,
        output_data: null,
        error_message: null,
        started_at: null,
        completed_at: null,
        provider: null,
        fallback_used: false,
        primary_provider_error: null,
      }
    )
  })
}
