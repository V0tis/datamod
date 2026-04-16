import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGeminiKeyForRequest, getGroqKeyForRequest, getAIPrimaryModelForRequest } from '@/lib/research-keys'
import { runPipelineGeminiGroqText } from '@/lib/ai/pipeline-text-completion'
import {
  INSIGHT_SUGGESTION_SYSTEM,
  buildInsightSuggestionUserPayload,
} from '@/lib/ai/insight-suggestion-prompt'
import { safeParseAiJson } from '@/lib/ai/safe-json-parse'
import type { InsightSuggestionRequestBody, InsightSuggestionResult } from '@/lib/types/insight-suggestion'
import { GEMINI_MODEL } from '@/lib/gemini-config'

export const runtime = 'nodejs'
export const maxDuration = 60

function clamp0to100(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, Math.round(n)))
}

const fallbackResult = (keyword: string): InsightSuggestionResult => ({
  opportunity_score: 50,
  risk_score: 50,
  risk_grade: '중간',
  attractiveness_grade: '보통',
  focus_market_keyword: keyword,
  rationale_one_liner: '분석 데이터가 부족해 요약만 표시합니다. 동일 키워드로 분석을 완료한 뒤 다시 시도해 주세요.',
  competition_overview: '',
  market_issue: '',
  recommended_action: '',
  used_fallback: true,
})

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: Partial<InsightSuggestionRequestBody>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const keyword = typeof body.keyword === 'string' ? body.keyword.trim() : ''
  if (!keyword) {
    return NextResponse.json({ error: 'keyword is required' }, { status: 400 })
  }

  const [geminiResult, groqKey, primaryModel] = await Promise.all([
    getGeminiKeyForRequest(supabase, user.id),
    getGroqKeyForRequest(supabase, user.id),
    getAIPrimaryModelForRequest(supabase, user.id),
  ])

  const geminiKey = geminiResult.gemini
  if (!geminiKey) {
    return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, { status: 503 })
  }

  const payload: InsightSuggestionRequestBody = {
    keyword,
    country_code: typeof body.country_code === 'string' ? body.country_code : undefined,
    trend_summary: typeof body.trend_summary === 'string' ? body.trend_summary : undefined,
    growth_signals: Array.isArray(body.growth_signals) ? body.growth_signals.filter((x): x is string => typeof x === 'string') : undefined,
    competitive_landscape: Array.isArray(body.competitive_landscape) ? body.competitive_landscape : undefined,
    market_structure: typeof body.market_structure === 'string' ? body.market_structure : undefined,
    strategic_gaps:
      body.strategic_gaps && typeof body.strategic_gaps === 'object'
        ? (body.strategic_gaps as InsightSuggestionRequestBody['strategic_gaps'])
        : undefined,
    news_items: Array.isArray(body.news_items) ? body.news_items : undefined,
    market_news_lines: Array.isArray(body.market_news_lines) ? body.market_news_lines.filter((x): x is string => typeof x === 'string') : undefined,
    negative_signals: Array.isArray(body.negative_signals) ? body.negative_signals.filter((x): x is string => typeof x === 'string') : undefined,
  }

  const userPrompt = buildInsightSuggestionUserPayload(payload)

  try {
    const completion = await runPipelineGeminiGroqText({
      step: 'insight_suggestion',
      geminiKey,
      groqKey: groqKey || undefined,
      primaryProvider: primaryModel === 'groq' ? 'groq' : 'gemini',
      systemInstruction: INSIGHT_SUGGESTION_SYSTEM,
      prompt: userPrompt,
      maxOutputTokens: 1200,
      groqMaxTokens: 1200,
      geminiModel: GEMINI_MODEL,
    })

    type Parsed = {
      opportunity_score?: number
      risk_score?: number
      risk_grade?: string
      attractiveness_grade?: string
      focus_market_keyword?: string
      rationale_one_liner?: string
      competition_overview?: string
      market_issue?: string
      recommended_action?: string
    }

    const parseResult = safeParseAiJson<Parsed>(completion.text ?? '', {
      fallback: {},
      logFailures: true,
      context: 'insight_suggestion',
    })

    const data = parseResult.ok ? parseResult.data : {}
    const out: InsightSuggestionResult = {
      opportunity_score: clamp0to100(data.opportunity_score),
      risk_score: clamp0to100(data.risk_score),
      risk_grade: typeof data.risk_grade === 'string' && data.risk_grade.trim() ? data.risk_grade.trim() : '중간',
      attractiveness_grade:
        typeof data.attractiveness_grade === 'string' && data.attractiveness_grade.trim()
          ? data.attractiveness_grade.trim()
          : '보통',
      focus_market_keyword:
        typeof data.focus_market_keyword === 'string' && data.focus_market_keyword.trim()
          ? data.focus_market_keyword.trim()
          : keyword,
      rationale_one_liner:
        typeof data.rationale_one_liner === 'string' && data.rationale_one_liner.trim()
          ? data.rationale_one_liner.trim()
          : `${keyword} 시장: 경쟁 구도·뉴스를 반영한 요약을 생성하지 못했습니다.`,
      competition_overview: typeof data.competition_overview === 'string' ? data.competition_overview.trim() : '',
      market_issue: typeof data.market_issue === 'string' ? data.market_issue.trim() : '',
      recommended_action: typeof data.recommended_action === 'string' ? data.recommended_action.trim() : '',
      used_fallback: completion.usedFallback,
    }

    if (!parseResult.ok || !out.rationale_one_liner || out.rationale_one_liner.length < 12) {
      const fb = fallbackResult(keyword)
      return NextResponse.json({ ...fb, used_fallback: true })
    }

    return NextResponse.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Insight suggestion failed'
    console.error('[insight-suggestion]', msg)
    return NextResponse.json(fallbackResult(keyword))
  }
}
