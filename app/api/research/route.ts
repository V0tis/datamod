import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

/** 현재 안정적인 무료 모델 (404 시 gemini-2.0-flash-001 또는 gemini-1.5-flash-latest 로 변경 가능) */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

/** 소스당 최대 문자 수 (토큰 절약) */
const MAX_CHARS_PER_SOURCE = 2000

const SYSTEM_INSTRUCTION =
  "당신은 시장 리서치 전문가 '린'입니다. 반드시 JSON 형식으로만 답변하세요."

const USER_PROMPT_PREFIX =
  '다음 데이터를 분석해 JSON으로 출력해: '
const USER_PROMPT_SUFFIX =
  '. 구조는 {marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100, publicReactionTrends: ""} 반드시 publicReactionTrends에는 이 이슈에 대한 대중들의 예상 반응과 온라인 트렌드 분석을 1~2문단으로 작성해줘.'

/** HTML 태그 제거, 연속 공백/줄바꿈을 하나로 (토큰 절약) */
function normalizeText(text: string): string {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** description/snippet 우선, 없으면 content를 최대 N자로 슬라이스 후 정규화 */
function buildSourceSummary(
  item: {
    description?: string
    snippet?: string
    markdown?: string
    content?: string
  },
  maxChars: number
): string {
  const preferred = item.description ?? item.snippet ?? ''
  const preferredNorm = normalizeText(preferred)
  if (preferredNorm.length >= 50) {
    return preferredNorm.slice(0, maxChars)
  }
  const full = item.markdown ?? item.content ?? ''
  const normalized = normalizeText(full)
  return normalized.slice(0, maxChars)
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
        searchOptions: { limit: 5 },
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
      data?: Array<{
        title?: string
        url?: string
        description?: string
        snippet?: string
        markdown?: string
        content?: string
      }>
    }
    const rawItems = (searchData.data ?? []).slice(0, 5)
    console.log('rawItems', rawItems);

    const sourceLinks = rawItems.map((d) => ({
      title: normalizeText(d.title ?? d.description ?? d.snippet ?? '제목 없음').slice(0, 200),
      url: typeof d.url === 'string' ? d.url : '',
    }))
    const sourceTexts = rawItems
      .map((d) => buildSourceSummary(d, MAX_CHARS_PER_SOURCE))
      .filter((s) => s.length > 0)
    const context = sourceTexts.length > 0 ? sourceTexts.join('\n\n') : '데이터 없음'

    // 2. Gemini 분석 (429 시 Retry-After 대기 후 재시도)
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: { maxOutputTokens: 1500 },
    })

    const prompt = USER_PROMPT_PREFIX + context + USER_PROMPT_SUFFIX
    const maxRetries = 2
    let lastError: unknown = null
    let responseText: string | null = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt)
        responseText = result.response.text()
        lastError = null
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
          await logAvailableModels(apiKey)
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
      publicReactionTrends:
        typeof parsed.publicReactionTrends === 'string' ? parsed.publicReactionTrends : '',
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
