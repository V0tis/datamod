import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

const INSIGHTS_SYSTEM =
  "당신은 시장 리서치와 대중 반응 분석 전문가 '린'입니다. 주어진 키워드·리포트 요약을 바탕으로, 해당 뉴스/이슈에 대한 **대중의 예상 반응**과 **SNS·커뮤니티 트렌드**를 2~4문단으로 분석해주세요. 감정·논란·기대·우려·해시태그 트렌드 등을 포함하면 좋습니다. 자연스러운 문단 형태로만 답변하세요."

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_GENERATIVE_AI_API_KEY is not set' },
      { status: 500 }
    )
  }

  let body: { keyword?: string; summary?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = body?.keyword ?? body?.query
  if (!keyword || typeof keyword !== 'string') {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }
  const summary = typeof body?.summary === 'string' ? body.summary : ''

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: INSIGHTS_SYSTEM,
  })

  const userPrompt = summary
    ? `키워드: "${keyword}"\n\n리포트 요약:\n${summary}\n\n위 내용을 바탕으로 대중 예상 반응과 커뮤니티 트렌드를 분석해주세요.`
    : `키워드: "${keyword}"\n\n이 키워드/이슈에 대한 대중의 예상 반응과 SNS·커뮤니티 트렌드를 분석해주세요.`

  try {
    const result = await model.generateContent(userPrompt)
    const text = result.response.text()
    const insights = (text || '').trim() || '분석 결과를 생성하지 못했어요.'
    return NextResponse.json({ insights })
  } catch (err) {
    console.error('[Research Insights API]', err)
    return NextResponse.json(
      { error: '유저 반응 분석 중 오류가 발생했어요.' },
      { status: 500 }
    )
  }
}
