import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GEMINI_DAILY_LIMIT = 1500
const FIRECRAWL_MONTHLY_LIMIT = 500
const SUPABASE_REPORTS_LIMIT = 50_000

export async function GET() {
  try {
    const supabase = await createClient()
    const today = new Date().toISOString().slice(0, 10)
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10)

    const [geminiRes, firecrawlRes, reportsRes] = await Promise.all([
      supabase
        .from('usage_stats')
        .select('count')
        .eq('used_date', today)
        .eq('service_type', 'gemini')
        .maybeSingle(),
      supabase
        .from('usage_stats')
        .select('used_date, count')
        .eq('service_type', 'firecrawl')
        .gte('used_date', startOfMonth)
        .lte('used_date', today),
      supabase.from('reports').select('id', { count: 'exact', head: true }),
    ])

    const geminiToday = geminiRes.data?.count ?? 0
    const firecrawlMonth =
      (firecrawlRes.data ?? []).reduce((sum, row) => sum + (row.count ?? 0), 0) as number
    const reportsCount = reportsRes.count ?? 0

    const payload = {
      gemini: { used: geminiToday, limit: GEMINI_DAILY_LIMIT },
      firecrawl: { used: firecrawlMonth, limit: FIRECRAWL_MONTHLY_LIMIT },
      supabase: { used: reportsCount, limit: SUPABASE_REPORTS_LIMIT },
    }

    return NextResponse.json(payload)
  } catch (e) {
    console.error('[usage API]', e)
    return NextResponse.json(
      {
        gemini: { used: 0, limit: GEMINI_DAILY_LIMIT },
        firecrawl: { used: 0, limit: FIRECRAWL_MONTHLY_LIMIT },
        supabase: { used: 0, limit: SUPABASE_REPORTS_LIMIT },
      },
      { status: 200 }
    )
  }
}
