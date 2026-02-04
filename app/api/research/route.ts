import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const keyword = body?.keyword ?? body?.query
    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json(
        { error: '검색어(keyword)가 필요합니다.' },
        { status: 400 }
      )
    }

    // 1. Firecrawl Search: 키워드로 최신 데이터 검색
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
        { error: '검색 데이터를 가져오지 못했습니다.' },
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

    // 2. Claude 3.5 Sonnet 분석
    const msg = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1500,
      system:
        "당신은 시장 리서치 전문가 '린'입니다. 반드시 JSON 형식으로만 답변하세요.",
      messages: [
        {
          role: 'user',
          content: `다음 데이터를 분석해 JSON으로 출력해: ${context}. 구조는 {marketNews: [], painPoints: [], competitorTrends: "", sentiment: 0~100}`,
        },
      ],
    })

    const block = msg.content[0]
    const responseText =
      block.type === 'text' ? block.text : ''

    const parsed = JSON.parse(responseText) as {
      marketNews?: string[]
      painPoints?: string[]
      competitorTrends?: string
      sentiment?: number
    }

    // sentiment는 0~100 숫자로 통일
    const sentiment =
      typeof parsed.sentiment === 'number'
        ? Math.min(100, Math.max(0, parsed.sentiment))
        : 0

    return NextResponse.json({
      marketNews: Array.isArray(parsed.marketNews) ? parsed.marketNews : [],
      painPoints: Array.isArray(parsed.painPoints) ? parsed.painPoints : [],
      competitorTrends:
        typeof parsed.competitorTrends === 'string'
          ? parsed.competitorTrends
          : '',
      sentiment,
    })
  } catch (e) {
    console.error('[Research API] 분석 실패:', e)
    return NextResponse.json(
      { error: '분석 실패' },
      { status: 500 }
    )
  }
}
