import { NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'

const SYSTEM_SUMMARY =
  "당신은 뉴스 요약 전문가입니다. 주어진 본문을 2~4문단으로 핵심만 간결하게 요약해 주세요. 불필요한 수식은 빼고, 사실과 의견을 구분해 주세요."

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'GOOGLE_GENERATIVE_AI_API_KEY is not set' },
      { status: 500 }
    )
  }

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  if (!content || content.length < 50) {
    return NextResponse.json(
      { error: '요약할 본문이 너무 짧거나 없습니다.' },
      { status: 400 }
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_SUMMARY,
  })

  const prompt = `다음 뉴스/기사 본문을 요약해 주세요.\n\n${content.slice(0, 12000)}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const summary = (text || '').trim() || '요약을 생성하지 못했어요.'
    return NextResponse.json({ summary })
  } catch (err) {
    console.error('[Summarize Article API]', err)
    return NextResponse.json(
      { error: '요약 생성 중 오류가 발생했어요.' },
      { status: 500 }
    )
  }
}
