import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getEffectiveLicenseKeys } from '@/lib/license'

/** 현재 안정적인 무료 모델 (404 시 gemini-2.0-flash-001 또는 gemini-1.5-flash-latest 로 변경 가능) */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. Google Search로 최신 웹 정보를 참고한 뒤, 반드시 JSON 형식으로만 답변하세요."

const USER_PROMPT_TEMPLATE = (keyword: string) =>
  `"${keyword}"에 대한 최신 트렌드·뉴스·유저 반응을 검색해서 분석한 뒤, 아래 JSON 구조로만 출력해줘. ` +
  `JSON: { marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100, publicReactionTrends: "", chartData: { sentiment: { positive: 0~100, neutral: 0~100, negative: 0~100 }, impact: [ { subject: "분야명", score: 0~10 } ] } }. ` +
  `positive+neutral+negative 합계 100, impact는 경제/사회/기술/정치/환경 등 5개 정도, publicReactionTrends는 1~2문단으로.`

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

function extractJsonFromText(text: string): string {
  const trimmed = text.trim()
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  return trimmed
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    let userGemini: string | null = null
    if (user?.id) {
      const { data: row } = await supabase
        .from('user_settings')
        .select('gemini_api_key')
        .eq('user_id', user.id)
        .maybeSingle()
      userGemini = row?.gemini_api_key ?? null
    }
    const effective = getEffectiveLicenseKeys(userGemini)
    if (!effective.canSearch || !effective.gemini) {
      return NextResponse.json(
        { error: '키를 등록해 주세요. 설정에서 API 키를 등록하면 분석을 사용할 수 있어요.' },
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

    // Gemini 분석 + Google Search 도구로 최신 웹 정보 참고
    const genAI = new GoogleGenerativeAI(effective.gemini)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { maxOutputTokens: 1500 },
      tools: [{ googleSearchRetrieval: {} }],
    })

    const prompt = USER_PROMPT_TEMPLATE(keyword.trim())
    const maxRetries = 2
    let lastError: unknown = null
    let responseText: string | null = null
    let sourceLinks: Array<{ title: string; url: string }> = []

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt)
        const resp = result.response
        responseText = resp.text()
        lastError = null
        // Google Search grounding 출처를 source_links로 사용
        type GroundingResp = { candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web?: { uri?: string; title?: string } }> } }> }
        const candidate = (resp as GroundingResp).candidates?.[0]
        const chunks = candidate?.groundingMetadata?.groundingChunks ?? []
        sourceLinks = chunks
          .map((c) => ({
            title: (c.web?.title ?? '제목 없음').slice(0, 200),
            url: c.web?.uri ?? '',
          }))
          .filter((l) => l.url)
        break
      } catch (geminiError: unknown) {
        lastError = geminiError
        const err = geminiError as { message?: string; status?: number }
        const msg = err?.message ?? String(geminiError)
        console.error('[Research API] Gemini API error (attempt', attempt + 1, '):', msg)

        const is429 =
          msg.includes('429') ||
          msg.includes('quota') ||
          msg.includes('resource exhausted') ||
          msg.includes('rate limit')

        if (is429 && attempt < maxRetries) {
          const retrySec =
            (msg.match(/retry[- ]after[:\s]+(\d+)/i)?.[1] &&
              parseInt(msg.match(/retry[- ]after[:\s]+(\d+)/i)![1], 10)) ||
            (msg.match(/(\d+)\s*초/i)?.[1] && parseInt(msg.match(/(\d+)\s*초/i)![1], 10)) ||
            60
          const waitMs = Math.min(retrySec * 1000, 120_000)
          console.info('[Research API] 429 감지.', waitMs / 1000, '초 후 재시도...')
          await new Promise((r) => setTimeout(r, waitMs))
          continue
        }

        const isModelNotFound =
          msg.includes('404') ||
          msg.includes('not found') ||
          /models\/[\w.-]+ is not found/i.test(msg)

        if (isModelNotFound) {
          await logAvailableModels(effective.gemini)
          return NextResponse.json(
            {
              error: `선택한 모델(${GEMINI_MODEL})을 사용할 수 없어요. 서버 로그에 사용 가능한 모델 목록이 출력되었으니, .env에 GEMINI_MODEL=모델명 을 설정해 주세요.`,
            },
            { status: 500 }
          )
        }

        if (msg.includes('API key') || msg.includes('invalid') || msg.includes('401')) {
          return NextResponse.json(
            { error: '린이 사용하는 API 키가 올바르지 않아요. 관리자에게 문의해 주세요.' },
            { status: 500 }
          )
        }
        if (msg.includes('429') || msg.includes('quota') || msg.includes('resource exhausted')) {
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
    }

    if (responseText == null) {
      console.error('[Research API] Gemini 재시도 후에도 실패:', lastError)
      return NextResponse.json(
        { error: '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      )
    }

    const rawJson = extractJsonFromText(responseText)
    let parsed: {
      marketNews?: string[]
      painPoints?: string[]
      competitorTrends?: string
      sentiment?: number
      publicReactionTrends?: string
      chartData?: {
        sentiment?: { positive?: number; neutral?: number; negative?: number }
        impact?: Array<{ subject?: string; score?: number }>
      }
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

    const sd = parsed.chartData?.sentiment
    const positive = Math.min(100, Math.max(0, typeof sd?.positive === 'number' ? sd.positive : 65))
    const neutral = Math.min(100, Math.max(0, typeof sd?.neutral === 'number' ? sd.neutral : 20))
    const negative = Math.min(100, Math.max(0, typeof sd?.negative === 'number' ? sd.negative : 15))
    const sum = positive + neutral + negative
    const chartSentiment = sum > 0
      ? { positive: Math.round((positive / sum) * 100), neutral: Math.round((neutral / sum) * 100), negative: Math.round((negative / sum) * 100) }
      : { positive: 65, neutral: 20, negative: 15 }
    const rawImpact = Array.isArray(parsed.chartData?.impact) ? parsed.chartData.impact : []
    const impactList = rawImpact
      .filter((i): i is { subject: string; score: number } => typeof i?.subject === 'string' && typeof i?.score === 'number')
      .map((i) => ({ subject: i.subject, score: Math.min(10, Math.max(0, i.score)) }))
      .slice(0, 8)
    const chartImpact = impactList.length > 0
      ? impactList
      : [
          { subject: '경제', score: 5 },
          { subject: '사회', score: 5 },
          { subject: '기술', score: 5 },
          { subject: '정치', score: 5 },
          { subject: '환경', score: 5 },
        ]
    const chartData = { sentiment: chartSentiment, impact: chartImpact }

    const summary = {
      marketNews: Array.isArray(parsed.marketNews) ? parsed.marketNews : [],
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      competitorTrends:
        typeof parsed.competitorTrends === 'string'
          ? parsed.competitorTrends
          : '',
      sentiment,
      publicReactionTrends:
        typeof parsed.publicReactionTrends === 'string' ? parsed.publicReactionTrends : '',
      chartData,
    }

    let reportId: string | null = null
    if (user?.id) {
      const { data: report, error: insertError } = await supabase
        .from('reports')
        .insert({
          user_id: user.id,
          keyword: keyword.trim(),
          content: summary,
          source_links: sourceLinks,
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
