import type { InsightSuggestionRequestBody } from '@/lib/types/insight-suggestion'

type TaskData = Partial<Record<string, unknown>>

type ResultShape = {
  marketNews?: string[]
  key_metrics?: {
    summary_insights?: string
    positive_signals?: string[]
    negative_risks?: string[]
    neutral_signals?: string[]
    competitive_landscape?: unknown[]
    market_structure?: { summary?: string }
    strategic_gaps?: InsightSuggestionRequestBody['strategic_gaps']
  }
} | null

export function buildInsightSuggestionRequestBody(input: {
  keyword: string
  countryCode: string
  result: ResultShape
  taskData: TaskData
  newsList: Array<{ title: string; publisher?: string }>
}): InsightSuggestionRequestBody | null {
  const kw = input.keyword?.trim()
  if (!kw) return null

  const td = input.taskData
  const trendOut = td['trend_analysis'] as
    | { trend_summary?: string; growth_signals?: string[]; market_temperature_score?: number }
    | undefined
  const compOut = td['competition_analysis'] as
    | {
        competitive_landscape?: unknown[]
        market_structure?: string
        strategic_gaps?: InsightSuggestionRequestBody['strategic_gaps']
      }
    | undefined

  const km = input.result?.key_metrics
  const competitive_landscape = Array.isArray(compOut?.competitive_landscape)
    ? compOut!.competitive_landscape
    : Array.isArray(km?.competitive_landscape)
      ? km!.competitive_landscape
      : undefined

  const market_structure =
    typeof compOut?.market_structure === 'string'
      ? compOut.market_structure
      : typeof km?.market_structure === 'object' &&
          km?.market_structure &&
          typeof (km.market_structure as { summary?: string }).summary === 'string'
        ? (km.market_structure as { summary: string }).summary
        : undefined

  const strategic_gaps = compOut?.strategic_gaps ?? km?.strategic_gaps

  const trend_summary =
    trendOut?.trend_summary?.trim() ||
    (typeof km?.summary_insights === 'string' ? km.summary_insights : undefined)

  const growth_signals = trendOut?.growth_signals ?? km?.positive_signals

  const news_items = input.newsList.slice(0, 20).map((n) => ({
    title: n.title,
    publisher: n.publisher,
  }))

  const market_news_lines = Array.isArray(input.result?.marketNews)
    ? (input.result!.marketNews as string[]).filter((s) => typeof s === 'string')
    : []

  const negative_signals = [
    ...(Array.isArray(km?.negative_risks) ? km!.negative_risks! : []),
    ...(km?.neutral_signals?.slice(0, 3) ?? []),
  ].filter((s): s is string => typeof s === 'string')

  if (!competitive_landscape?.length && !news_items.length && !trend_summary) {
    return null
  }

  return {
    keyword: kw,
    country_code: input.countryCode,
    trend_summary,
    growth_signals,
    competitive_landscape,
    market_structure,
    strategic_gaps,
    news_items,
    market_news_lines: market_news_lines.length ? market_news_lines : undefined,
    negative_signals: negative_signals.length ? negative_signals : undefined,
  }
}
