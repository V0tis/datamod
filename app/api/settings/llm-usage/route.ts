import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserLlmUsageTotals } from '@/lib/llm-usage-record'

export const dynamic = 'force-dynamic'

/** 누적 LLM 토큰·호출 수 (llm_usage_log) */
export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const totals = await getUserLlmUsageTotals(supabase, user.id)
    return NextResponse.json(totals)
  } catch (e) {
    console.error('[llm-usage GET]', e)
    return NextResponse.json(
      { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, callCount: 0 },
      { status: 200 }
    )
  }
}
