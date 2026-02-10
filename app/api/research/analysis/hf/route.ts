import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const HF_MODEL = process.env.HF_ANALYSIS_MODEL ?? 'mistralai/Mistral-7B-Instruct-v0.3'
const HF_MODEL_LABEL = process.env.HF_MODEL_LABEL ?? 'Mistral'

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

  const apiKey = (process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN ?? '').trim()
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Hugging Face API 키가 설정되지 않았습니다. 서버 환경변수 HUGGINGFACE_API_KEY를 설정해 주세요.' },
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

  const maxRetries = 3
  const delays = [2000, 4000, 6000]
  let lastStatus = 500
  let lastError = 'Hugging Face 요청 실패'

  try {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch('https://router.huggingface.co/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: HF_MODEL,
          instructions: '시장 리서치 요약을 간결하고 마크다운 형식으로 작성해 주세요.',
          input: prompt,
          max_output_tokens: 1024,
        }),
      })

      const raw = await res.text()
      lastStatus = res.status
      const isRetryable =
        res.status === 503 ||
        res.status === 410 ||
        /loading|overloaded|traffic|트래픽|rate limit|try again/i.test(raw)

      if (!res.ok && isRetryable && attempt < maxRetries - 1) {
        lastError = raw.slice(0, 200) || '일시적 오류'
        console.warn('[Research Analysis HF]', res.status, '재시도', attempt + 1, '/', maxRetries, lastError)
        await new Promise((r) => setTimeout(r, delays[attempt]))
        continue
      }

      let generatedText = ''
      if (res.ok) {
        try {
          const data = JSON.parse(raw) as {
            output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
          }
          const msg = data.output?.find((o) => o.type === 'message')
          const textBlock = msg?.content?.find((c) => c.type === 'output_text')
          generatedText = (textBlock?.text ?? '').trim()
        } catch {
          generatedText = raw.slice(0, 2000).trim()
        }
      }

      if (!res.ok) {
        lastError = raw.slice(0, 200) || 'Hugging Face 요청 실패'
        console.warn('[Research Analysis HF]', res.status, lastError)
        return NextResponse.json(
          { error: lastError, code: res.status === 429 ? 'QUOTA' : res.status === 503 ? 'TRAFFIC' : undefined },
          { status: res.status >= 400 ? res.status : 500 }
        )
      }

      const payload = {
        summary: generatedText || '분석 결과를 생성하지 못했어요.',
        modelName: HF_MODEL_LABEL,
      }

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
              analysis_hf: payload,
              updated_at: new Date().toISOString(),
            })
            .eq('report_id', reportId)
        }
      }

      return NextResponse.json(payload)
    }

    return NextResponse.json(
      { error: lastError, code: lastStatus === 503 ? 'TRAFFIC' : undefined },
      { status: lastStatus >= 400 ? lastStatus : 500 }
    )
  } catch (e) {
    console.warn('[Research Analysis HF]', e)
    return NextResponse.json(
      { error: 'Hugging Face 분석 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
