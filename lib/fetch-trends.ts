import { parseJsonResponse } from '@/lib/fetch-json'
import { normalizeTrendItems, type TrendItem, type TrendsResponse } from '@/lib/trends-types'

export type FetchTrendsResult = {
  items: TrendItem[]
  updatedAt: string | null
  refreshed?: boolean
  refreshFailed?: boolean
}

/**
 * Fetches trends for a country from the API. Client-side only.
 */
export async function fetchTrendsForCountry(
  country: string,
  options?: { refresh?: boolean }
): Promise<FetchTrendsResult> {
  try {
  const url = `/api/trends?country=${country}${options?.refresh ? '&refresh=1' : ''}`
  const res = await fetch(url)
  const data = await parseJsonResponse<
    TrendsResponse & { refreshed?: boolean; refreshFailed?: boolean }
  >(res)
  const items = normalizeTrendItems(
    Array.isArray((data as unknown as Record<string, unknown>)[country])
      ? ((data as unknown as Record<string, TrendItem[]>)[country])
      : []
  )
  return {
    items,
    updatedAt: data.updatedAt ?? null,
    refreshed: data.refreshed,
    refreshFailed: data.refreshFailed,
  }
  } catch (e) {
    console.warn('[fetchTrendsForCountry]', e)
    return {
      items: [],
      updatedAt: null,
      refreshFailed: true,
    }
  }
}
