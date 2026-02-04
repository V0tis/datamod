import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. 반드시 JSON 형식으로만 답변하세요."

const USER_PROMPT_PREFIX =
  '다음 데이터를 분석해 JSON으로 출력해: '
const USER_PROMPT_SUFFIX =
  '. 구조는 {marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100}'

function extractJsonFromText(text: string): string {
  const trimmed = text.trim()
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  return trimmed
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!apiKey) {
      console.error('[Research API] GOOGLE_GENERATIVE_AI_API_KEY is not set')
      return NextResponse.json(
        { error: '린이 분석할 수 있도록 API 설정이 필요해요. 관리자에게 문의해 주세요.' },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json()
    const keyword = body?.keyword ?? body?.query
    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: '검색어(keyword)가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. Firecrawl Search
    const searchRes = await fetch('https://api.firecrawl.dev/v0/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({
        query: `${keyword} 최신 트렌드 유저 반응`,
        searchOptions: { limit: 3 },
      }),
    })

    if (!searchRes.ok) {
      const errText = await searchRes.text()
      console.error('[Research API] Firecrawl search failed:', searchRes.status, errText)
      return NextResponse.json(
        { error: '검색 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 502 }
      )
    }

    const searchData = (await searchRes.json()) as {
      data?: Array<{ markdown?: string; content?: string; snippet?: string }>
    }
    const context =
      searchData.data
        ?.map((d) => d.markdown ?? d.content ?? d.snippet ?? '')
        .filter(Boolean)
        .join('\n\n') || '데이터 없음'

    // 2. Gemini 분석
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { maxOutputTokens: 1500 },
    })

    let responseText: string
    try {
      const result = await model.generateContent(
        USER_PROMPT_PREFIX + context + USER_PROMPT_SUFFIX
      )
      responseText = result.response.text()
    } catch (geminiError: unknown) {
      const err = geminiError as { message?: string; status?: number }
      const msg = err?.message ?? String(geminiError)
      console.error('[Research API] Gemini API error:', msg)

      if (msg.includes('API key') || msg.includes('invalid') || msg.includes('401')) {
        return NextResponse.json(
          { error: '린이 사용하는 API 키가 올바르지 않아요. 관리자에게 문의해 주세요.' },
          { status: 500 }
        )
      }
      if (msg.includes('quota') || msg.includes('429') || msg.includes('resource exhausted')) {
        return NextResponse.json(
          { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' },
          { status: 429 }
        )
      }
      if (msg.includes('blocked') || msg.includes('safety')) {
        return NextResponse.json(
          { error: '안전 설정으로 인해 분석 결과를 만들 수 없어요. 다른 검색어로 시도해 주세요.' },
          { status: 400 }
        )
      }
      return NextResponse.json(
        { error: '린이 분석하는 중 오류가 났어요. 잠시 후 다시 시도해 주세요.' },
        { status: 500 }
      )
    }

    const rawJson = extractJsonFromText(responseText)
    let parsed: {
      marketNews?: string[]
      painPoints?: string[]
      competitorTrends?: string
      sentiment?: number
    }
    try {
      parsed = JSON.parse(rawJson) as typeof parsed
    } catch {
      console.error('[Research API] Invalid JSON from Gemini:', rawJson.slice(0, 200))
      return NextResponse.json(
        { error: '분석 결과 형식이 올바르지 않아요. 다시 검색해 주세요.' },
        { status: 500 }
      )
    }

    const sentiment =
      typeof parsed.sentiment === 'number'
        ? Math.min(100, Math.max(0, parsed.sentiment))
        : 0

    const summary = {
      marketNews: Array.isArray(parsed.marketNews) ? parsed.marketNews : [],
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      competitorTrends:
        typeof parsed.competitorTrends === 'string'
          ? parsed.competitorTrends
          : '',
      sentiment,
    }

    let reportId: string | null = null
    if (user?.id) {
      const { data: report, error: insertError } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          keyword: keyword.trim(),
          content: summary,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[Research API] Report insert failed:', insertError)
      } else {
        reportId = report?.id ?? null
      }
    }

    return NextResponse.json({
      ...summary,
      reportId,
    })
  } catch (e) {
    console.error('[Research API] 분석 실패:', e)
    return NextResponse.json(
      { error: '예기치 않은 오류가 났어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
