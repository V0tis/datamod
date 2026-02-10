import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.1-8b-instant'
const GROQ_MODEL_LABEL = process.env.GROQ_MODEL_LABEL ?? 'Llama-3'

function buildPrompt(keyword: string, summary: string, newsHeadlines: string): string {
  const parts: string[] = [
    `"${keyword}"에 대한 시장 리서치 요약을 작성해 주세요.`,
    summary ? `\n[리포트 요약]\n${summary}` : '',
    newsHeadlines ? `\n[참고 뉴스 제목]\n${newsHeadlines}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const apiKey = process.env.GROQ_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Groq API 키가 설정되지 않았습니다. 서버 환경변수 GROQ_API_KEY를 설정해 주세요.' },
      { status: 400 }
    )
  }

  let body: { keyword?: string; summary?: string; reportId?: string; newsHeadlines?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = (body.keyword ?? '').trim()
  const summary = typeof body.summary === 'string' ? body.summary : ''
  const reportId = typeof body.reportId === 'string' ? body.reportId : null
  const newsHeadlines = typeof body.newsHeadlines === 'string' ? body.newsHeadlines : ''

  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  const prompt = buildPrompt(keyword, summary, newsHeadlines)

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    })

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      error?: { message?: string }
    }

    if (!res.ok) {
      const errMsg = data?.error?.message ?? data ? String(data) : 'Groq 요청 실패'
      console.warn('[Research Analysis Groq]', res.status, errMsg)
      return NextResponse.json(
        { error: errMsg, code: res.status === 429 ? 'QUOTA' : undefined },
        { status: res.status >= 400 ? res.status : 500 }
      )
    }

    const text = data?.choices?.[0]?.message?.content?.trim() ?? ''
    const payload = { summary: text || '분석 결과를 생성하지 못했어요.', modelName: GROQ_MODEL_LABEL }

    if (reportId) {
      const { data: report } = await supabase
        .from('reports')
        .select('user_id')
        .eq('id', reportId)
        .single()
      if (report?.user_id === user.id) {
        await supabase
          .from('research_history')
          .update({
            analysis_groq: payload,
            updated_at: new Date().toISOString(),
          })
          .eq('report_id', reportId)
      }
    }

    return NextResponse.json(payload)
  } catch (e) {
    console.warn('[Research Analysis Groq]', e)
    return NextResponse.json(
      { error: 'Groq 분석 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
