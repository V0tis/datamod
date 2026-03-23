/**
 * PDF export for analysis reports.
 * - printReportAsPdf: Opens print dialog (legacy, prints current page)
 * - exportAnalysisToPdf: Generates a consulting-style PDF report from analysis data
 */

import React from 'react'
import type { ResearchResponse } from '@/lib/stores/research-store'
import type { PdfReportPayload } from '@/components/pdf/ConsultingReportDocument'

function buildPdfPayload(
  keyword: string,
  displayResult: ResearchResponse | null,
  taskData: Record<string, unknown>,
  countryCode?: string
): PdfReportPayload {
  const km = displayResult?.key_metrics
  const strategyOutput = taskData?.strategy_generation as {
    risks?: string[]
    opportunities?: string[]
    strategy_summary?: string
  } | undefined
  const competitionOutput = taskData?.competition_analysis as {
    competitive_landscape?: Array<{
      name?: string
      positioning?: string
      strength?: string
      weakness?: string
    }>
  } | undefined
  const executionOutput = taskData?.execution_layer as {
    product_idea?: string
    target_customer?: string
    monetization?: string
    product_actions?: Array<{ action?: string; reasoning?: string; priority?: string }>
    pm_action_plan?: Array<{ action_title?: string; description?: string; priority?: string }>
    next_actions_pm?: Array<{ action?: string; why?: string; priority?: string }>
  } | undefined

  const competitors = Array.isArray(competitionOutput?.competitive_landscape)
    ? competitionOutput.competitive_landscape
    : Array.isArray(km?.competitive_landscape)
      ? (km.competitive_landscape as Array<{ name?: string; positioning?: string; strength?: string; weakness?: string }>)
      : []

  const pmPlan = km?.pm_action_plan ?? []
  const pmActions = km?.pm_actions?.recommended_actions ?? []
  const productActions = executionOutput?.product_actions ?? []
  const nextActionsPm = executionOutput?.next_actions_pm ?? []
  const actionPlan =
    pmPlan.length > 0
      ? pmPlan.map((a) => ({
          action_title: a.action_title,
          description: a.description ?? a.expected_outcome,
          priority: a.priority,
        }))
      : pmActions.length > 0
        ? pmActions.map((a) => ({
            title: typeof a === 'string' ? a : (a as { title?: string }).title,
            reasoning: typeof a === 'object' && a && typeof (a as { reasoning?: string }).reasoning === 'string'
              ? (a as { reasoning: string }).reasoning
              : undefined,
            priority:
              typeof a === 'object' && a
                ? ((a as { urgency_level?: string }).urgency_level as string | undefined)
                : undefined,
          }))
        : [
            ...productActions.map((a) => ({
              action_title: a.action,
              description: a.reasoning,
              priority: a.priority,
            })),
            ...nextActionsPm.map((a) => ({
              action_title: a.action,
              description: a.why,
              priority: a.priority,
            })),
          ]

  return {
    keyword: keyword || '시장',
    countryCode,
    generatedAt: displayResult?.updated_at
      ? new Date(displayResult.updated_at).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
    marketSummary:
      km?.market_summary ??
      (typeof strategyOutput?.strategy_summary === 'string' ? strategyOutput.strategy_summary : undefined),
    marketTemperature: km?.market_temperature_score ?? km?.sentiment ?? undefined,
    opportunityScore: km?.opportunity_score ?? undefined,
    positiveSignals:
      km?.positive_signals ??
      displayResult?.marketNews ??
      (Array.isArray(strategyOutput?.opportunities) ? strategyOutput.opportunities : []),
    negativeRisks:
      km?.negative_risks ??
      displayResult?.painPoints ??
      (Array.isArray(strategyOutput?.risks) ? strategyOutput.risks : []),
    keyInsights: (km?.key_strategic_insights ?? km?.keyConclusions ?? []).filter(
      (s): s is string => typeof s === 'string'
    ),
    summaryInsights: km?.summary_insights,
    strategySummary:
      strategyOutput?.strategy_summary ??
      km?.summary_insights ??
      km?.recommended_product_strategy?.summary,
    productStrategy: km?.recommended_product_strategy ?? {
      product_idea: executionOutput?.product_idea,
      target_customer: executionOutput?.target_customer,
      monetization: executionOutput?.monetization,
    },
    competitors: competitors.map((c) => ({
      name: c.name,
      positioning: c.positioning,
      strength: c.strength,
      weakness: c.weakness,
    })),
    actionPlan,
  }
}

/**
 * Opens the browser print dialog. Use "Save as PDF" to export.
 */
export function printReportAsPdf(): void {
  if (typeof window === 'undefined') return
  window.print()
}

/**
 * Generates and downloads a professional consulting-style PDF report from analysis data.
 */
export async function exportAnalysisToPdf(
  keyword: string,
  displayResult: ResearchResponse | null,
  taskData: Record<string, unknown>,
  options?: { countryCode?: string; onError?: (err: unknown) => void }
): Promise<void> {
  if (typeof window === 'undefined') return

  try {
    const { pdf } = await import('@react-pdf/renderer')
    const { ConsultingReportDocument } = await import('@/components/pdf/ConsultingReportDocument')

    const payload = buildPdfPayload(
      keyword,
      displayResult,
      taskData,
      options?.countryCode
    )

    // ConsultingReportDocument wraps Document; pdf() expects DocumentProps - cast for compatibility
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blob = await pdf(React.createElement(ConsultingReportDocument, { data: payload }) as any).toBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(keyword || 'report').replace(/[^a-zA-Z0-9가-힣_-]/g, '_')}_market_analysis.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('[PDF Export]', err)
    options?.onError?.(err)
    throw err
  }
}
