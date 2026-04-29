import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 30
import { GEMINI_MODEL } from '@/lib/gemini-config'
import { isRateLimitResponse, getRateLimitGracefulMessage } from '@/lib/api/rate-limit'
import { generateText, completeChat } from '@/lib/ai'
import { getGeminiKeyForRequest, getGroqKeyForRequest, getAIPrimaryModelForRequest } from '@/lib/research-keys'
import { PM_ANALYSIS_PRINCIPLES } from '@/lib/ai/pm-analysis-framework'

const FOLLOW_UP_SYSTEM = `${PM_ANALYSIS_PRINCIPLES}

시장·대중 반응 분석 전문가. 앞서 제시된 유저 반응 요약·맥락만 근거로 답변. 질문이 모호하면 추론 후 가정은 [Hypothesis]로 표시. 1~3문단. 질문·대화형 표현 금지.`

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const [geminiResult, groqKey, primaryModel] = await Promise.all([
    getGeminiKeyForRequest(supabase, user.id),
    getGroqKeyForRequest(supabase, user.id),
    getAIPrimaryModelForRequest(supabase, user.id),
  ])

  const useGroq = primaryModel === 'groq' && !!groqKey
  const hasKey = useGroq ? !!groqKey : !!geminiResult.gemini
  if (!hasKey) {
    return NextResponse.json(
      { error: useGroq ? 'Groq API 키가 설정되지 않았습니다.' : 'Gemini API 키가 설정되지 않았습니다.' },
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
    let answer: string
    if (useGroq) {
      const result = await completeChat({
        apiKey: groqKey,
        messages: [
          { role: 'system', content: FOLLOW_UP_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
      })
      answer = (result.text || '').trim() || '답변을 생성하지 못했습니다.'
    } else {
      const text = await generateText({
        apiKey: geminiResult.gemini,
        prompt: userPrompt,
        systemInstruction: FOLLOW_UP_SYSTEM,
        model: GEMINI_MODEL,
      })
      answer = (text || '').trim() || '답변을 생성하지 못했습니다.'
    }
    return NextResponse.json({ answer })
  } catch (err) {
    console.error('[Follow-up API] provider:', primaryModel, err)
    const message = isRateLimitResponse(err)
      ? getRateLimitGracefulMessage()
      : '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
