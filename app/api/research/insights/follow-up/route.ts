import { NextResponse } from 'next/server'
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { RATE_LIMIT_USER_MESSAGE } from '@/lib/gemini-retry'
import { getSystemGeminiKey } from '@/lib/license'
import { generateText } from '@/lib/ai'

const FOLLOW_UP_SYSTEM =
  "당신은 시장 리서치와 대중 반응 분석 전문가입니다. 사용자가 유저 반응 분석 내용에 대해 추가로 질문했을 때, **앞서 제시된 유저 반응 요약과 맥락**만 바탕으로 간결하고 명확하게 답변해주세요. 1~3문단 이내로 작성해주세요."

/** Follow-up Q&A on previous insights; uses system Gemini key only. */
export async function POST(req: Request) {
  const apiKey = getSystemGeminiKey()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API key is not set. Set GOOGLE_GENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY in environment.' },
      { status: 503 }
    )
  }

  let body: { keyword?: string; previousInsights?: string; question?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = body?.keyword ?? ''
  const previousInsights = typeof body?.previousInsights === 'string' ? body.previousInsights : ''
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  const userPrompt = previousInsights
    ? `키워드: "${keyword}"\n\n[앞서 제시된 유저 반응 요약]\n${previousInsights}\n\n[추가 질문]\n${question}\n\n위 유저 반응 요약을 바탕으로 질문에 답변해주세요.`
    : `키워드: "${keyword}"\n\n[추가 질문]\n${question}\n\n질문에 답변해주세요.`

  try {
    const text = await generateText({
      apiKey,
      prompt: userPrompt,
      systemInstruction: FOLLOW_UP_SYSTEM,
      model: GEMINI_MODEL,
    })
    const answer = (text || '').trim() || '답변을 생성하지 못했습니다.'
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[Insights Follow-up API] (all retries exhausted)', err)
    // 503 + user-facing message: client shows toast; user can retry the question.
    return NextResponse.json(
      { error: RATE_LIMIT_USER_MESSAGE },
      { status: 503 }
    )
  }
}
