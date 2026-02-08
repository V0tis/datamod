import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveLicenseKeys } from '@/lib/license'
import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash'
const MAX_RETRIES = 2

export type TabType = 'logic' | 'creative' | 'fact'

const TAB_SYSTEM_PROMPTS: Record<TabType, string> = {
  logic:
    "당신은 시장 리서치와 전략 분석 전문가 '린'입니다. **SWOT 분석**, **인과관계**, **시장 규모·데이터**를 중심으로 논리적으로 분석해주세요. 숫자와 근거를 명시하고 2~4문단으로 답변하세요.",
  creative:
    "당신은 시장 리서치와 아이디어 전문가 '린'입니다. **틈새 시장 공략법**, **마케팅 아이디어**, **확장 가능성**을 중심으로 창의적으로 제안해주세요. 실행 가능한 아이디어를 2~4문단으로 답변하세요.",
  fact:
    "당신은 시장 리서치와 팩트체크 전문가 '린'입니다. **최신 뉴스 출처**, **구체적 통계 수치**, **타임라인**을 중심으로 사실 위주로 정리해주세요. 출처와 숫자를 명시하고 2~4문단으로 답변하세요.",
}

function getRetryDelaySeconds(err: unknown): number {
  const obj = err as { message?: string; retryDelay?: number; [k: string]: unknown }
  if (typeof obj?.retryDelay === 'number' && obj.retryDelay > 0) return Math.min(obj.retryDelay, 120)
  const msg = String(obj?.message ?? '')
  const match = msg.match(/(?:retry[- ]?after|retryDelay)[:\s]+(\d+)/i)
  if (match) return Math.min(parseInt(match[1], 10) || 60, 120)
  return 60
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const { data: row } = await supabase
    .from('user_settings')
    .select('gemini_api_key')
    .eq('user_id', user.id)
    .maybeSingle()
  const effective = getEffectiveLicenseKeys(row?.gemini_api_key ?? null, null)
  const apiKey = effective.gemini
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Gemini API 키가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  let body: { keyword?: string; summary?: string; tab?: string; reportId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = body?.keyword ?? ''
  const summary = typeof body?.summary === 'string' ? body.summary : ''
  const tab = body?.tab as TabType | undefined
  const reportId = typeof body?.reportId === 'string' ? body.reportId : null

  if (!tab || !TAB_SYSTEM_PROMPTS[tab]) {
    return NextResponse.json({ error: 'tab must be one of logic, creative, fact' }, { status: 400 })
  }
  if (!keyword || typeof keyword !== 'string') {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  const systemInstruction = TAB_SYSTEM_PROMPTS[tab]
  const userPrompt = summary
    ? `키워드: "${keyword}"\n\n리포트 요약:\n${summary}\n\n위 요약을 바탕으로 요청한 관점으로 분석해주세요.`
    : `키워드: "${keyword}"\n\n이 키워드/이슈에 대해 요청한 관점으로 분석해주세요.`

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
  })

  let lastError: unknown = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await model.generateContent(userPrompt)
      const text = (result.response.text() || '').trim() || '분석 결과를 생성하지 못했어요.'

      if (reportId) {
        const { data: report } = await supabase
          .from('reports')
          .select('user_id, ai_responses')
          .eq('id', reportId)
          .single()
        if (report?.user_id === user.id) {
          const current = (report.ai_responses as Record<string, string>) ?? {}
          await supabase
            .from('reports')
            .update({
              ai_responses: { ...current, [tab]: text },
            })
            .eq('id', reportId)
        }
      }

      return NextResponse.json({ text })
    } catch (err) {
      lastError = err
      const msg = String((err as { message?: string })?.message ?? err)
      const is429 =
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('resource exhausted') ||
        msg.includes('rate limit')
      if (is429 && attempt < MAX_RETRIES) {
        const waitSec = getRetryDelaySeconds(err)
        await new Promise((r) => setTimeout(r, waitSec * 1000))
        continue
      }
      console.error('[Research Insights Tab API]', tab, err)
      return NextResponse.json(
        { error: '분석 중 오류가 발생했어요. 네트워크나 API 한도를 확인해 주세요.' },
        { status: 500 }
      )
    }
  }

  console.error('[Research Insights Tab API] max retries', lastError)
  return NextResponse.json(
    { error: '분석 중 오류가 발생했어요.' },
    { status: 500 }
  )
}
