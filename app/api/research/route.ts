import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { RATE_LIMIT_USER_MESSAGE } from '@/lib/gemini-retry'
import { getResearchKeysForInitialAnalysis } from '@/lib/research-keys'
import { parseInitialResearchResponse } from '@/lib/research-parser'
import { generateResearchWithGrounding } from '@/lib/ai'
import { GROUNDING_RESEARCH_SYSTEM } from '@/lib/ai/pm-analysis-prompts'

function buildGroundingUserPrompt(keyword: string): string {
  return `키워드 "${keyword}"에 대한 최신 트렌드·뉴스·유저 반응을 검색하여 분석. JSON만 출력.

규칙: meta.analysis_target과 meta.analysis_scope를 키워드에서 추론. facts 3~5개, hypotheses 0~3개, inferences 2~4개, recommended_actions 2~4개, meta.generated_at은 현재 시각 ISO 8601.`
}

/** 디버깅: API 키로 사용 가능한 모델 목록을 콘솔에 출력 (404/모델 없음 시 호출) */
async function logAvailableModels(apiKey: string): Promise<void> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`
    )
    const data = (await res.json()) as { models?: Array<{ name: string }>; error?: { message?: string } }
    if (data.error) {
      console.error('[Research API] listModels error:', data.error.message ?? data.error)
      return
    }
    const names = (data.models ?? []).map((m) => m.name.replace(/^models\//, ''))
    console.info('[Research API] 사용 가능한 Gemini 모델 목록 (현재 모델:', GEMINI_MODEL, '):', names)
  } catch (e) {
    console.error('[Research API] listModels fetch failed:', e)
  }
}

/** Initial research (non-stream): resolve keys → Gemini with grounding or OpenAI fallback → parse JSON → upsert report. */
export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const keys = await getResearchKeysForInitialAnalysis(supabase, user?.id)
    const hasGemini = keys.canSearch && !!keys.gemini
    const openaiKey = keys.openai
    if (!hasGemini && !openaiKey) {
      return NextResponse.json(
        { error: '설정에서 Gemini 또는 OpenAI API 키를 등록한 뒤 분석을 사용할 수 있습니다.' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const keyword = body?.keyword ?? body?.query
    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: '검색어(keyword)가 필요합니다.' },
        { status: 400 }
      )
    }

    const prompt = buildGroundingUserPrompt(keyword.trim())
    let responseText: string | null = null
    let sourceLinks: Array<{ title: string; url: string }> = []

    if (hasGemini) {
      try {
        const result = await generateResearchWithGrounding({
          apiKey: keys.gemini,
          prompt,
          systemInstruction: GROUNDING_RESEARCH_SYSTEM,
          maxOutputTokens: 1500,
          model: GEMINI_MODEL,
          isRetryable: (err) => {
            const msg = String((err as { message?: string })?.message ?? err)
            if (/404|not found|invalid model/i.test(msg)) return false
            return /429|quota|resource exhausted|rate limit|5\d{2}/i.test(msg)
          },
        })
        responseText = result.text
        sourceLinks = result.sourceLinks
      } catch (geminiError: unknown) {
        const msg = String((geminiError as { message?: string })?.message ?? geminiError)
        console.warn('[Research API] Gemini error (all retries exhausted)', msg)
        if (/404|not found|invalid model/i.test(msg)) {
          logAvailableModels(keys.gemini)
          console.warn('[Research API] Gemini 404/모델 오류 → GPT Fallback 시도')
        }
      }
    }

    // Fallback when Gemini fails (404, quota, or 5xx) so the user still gets a result.
    if (responseText == null && openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey })
        const completion = await openai.chat.completions.create({
          model: process.env.OPENAI_FALLBACK_MODEL ?? 'gpt-4o-mini',
          messages: [
            { role: 'system', content: GROUNDING_RESEARCH_SYSTEM },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1500,
        })
        responseText = completion.choices[0]?.message?.content ?? null
        if (responseText) console.info('[Research API] GPT Fallback 사용')
      } catch (e) {
        console.error('[Research API] GPT Fallback 실패:', e)
      }
    }

    if (responseText == null) {
      return NextResponse.json(
        { error: RATE_LIMIT_USER_MESSAGE },
        { status: 503 }
      )
    }

    const parsed = parseInitialResearchResponse(responseText, { repair: false })
    if (!parsed.ok) {
      return NextResponse.json(
        { error: parsed.error },
        { status: 500 }
      )
    }

    const { summary: s } = parsed
    const summary = {
      marketNews: s.marketNews,
      painPoints: s.painPoints,
      competitorTrends: s.competitorTrends,
      sentiment: s.sentiment,
      publicReactionTrends: s.publicReactionTrends,
      chartData: s.chartData,
    }

    let reportId: string | null = null
    if (user?.id) {
      try {
        const { data: report, error: insertError } = await supabase
          .from('reports')
          .insert({
            user_id: user.id,
            keyword: keyword.trim(),
            content: summary,
            source_links: sourceLinks,
            ai_responses: {},
          })
          .select('id')
          .single()
        if (!insertError && report?.id) reportId = report.id
        else if (insertError) console.warn('[Research API] Report insert failed (컬럼 확인):', insertError.message)
      } catch (e) {
        console.warn('[Research API] Report insert:', e)
      }
    }

    return NextResponse.json({
      ...summary,
      reportId,
    })
  } catch (e) {
    console.error('[Research API] 분석 실패:', e)
    return NextResponse.json(
      { error: '분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
