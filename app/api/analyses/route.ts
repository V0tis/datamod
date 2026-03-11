import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** GET: List analysis history for current user. ?q=search&limit=50&offset=0 */
export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()?.toLowerCase() ?? ''
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') ?? '50', 10) || 50))
    const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)

    let query = supabase
      .from('analysis_history')
      .select('id, report_id, market_keyword, product_name, generated_insights, strategy_recommendation, action_plan, country_code, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (q) {
      query = query.or(`market_keyword.ilike.%${q}%,product_name.ilike.%${q}%,strategy_recommendation.ilike.%${q}%`)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('[Analyses API] list:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const list = (rows ?? []).map((r) => ({
      id: r.id,
      report_id: r.report_id ?? null,
      market_keyword: r.market_keyword ?? '',
      product_name: r.product_name ?? null,
      generated_insights: r.generated_insights ?? null,
      strategy_recommendation: r.strategy_recommendation ?? null,
      action_plan: r.action_plan ?? null,
      country_code: r.country_code ?? 'KR',
      created_at: r.created_at ?? null,
      date: r.created_at ? new Date(r.created_at).toLocaleDateString('ko-KR') : '',
    }))

    let countQuery = supabase
      .from('analysis_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (q) {
      countQuery = countQuery.or(`market_keyword.ilike.%${q}%,product_name.ilike.%${q}%,strategy_recommendation.ilike.%${q}%`)
    }
    const { count } = await countQuery

    return NextResponse.json({ list, total: count ?? list.length })
  } catch (e) {
    console.error('[Analyses API] GET:', e)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}
