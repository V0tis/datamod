import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GROQ_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'
const HF_MODEL = process.env.HF_TAB_MODEL ?? 'mistralai/Mistral-7B-Instruct-v0.3'
const UNIFIED_ERROR_MESSAGE = '현재 AI 엔진 트래픽이 높습니다. 잠시 후 다시 시도해 주세요.'

export type TabType = 'logic' | 'creative' | 'fact'

/** 탭별 시스템/유저 프롬프트: 시장 분석 / 인사이트 / 종합 리포트 */
function buildUserPrompt(
  tab: TabType,
  keyword: string,
  summary: string,
  newsHeadlines: string,
  logicText: string,
  creativeText: string
): string {
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인 (news_items_ko):\n${newsHeadlines}\n\n` : ''
  const baseSummary = summary ? `리포트 요약:\n${summary}\n\n` : ''

  // 시장 분석: 뉴스 정보만으로 AI 분석. 리포트 요약은 넣지 않고 뉴스 헤드라인만 사용.
  if (tab === 'logic') {
    if (newsBlock) {
      return `키워드: "${keyword}"${newsBlock}위 실시간 뉴스(헤드라인)만 바탕으로, 이 뉴스들이 시사하는 내용을 정리해 주세요. 뉴스 요약과 뉴스가 말해 주는 시장·이슈 관점을 2~4문단으로 작성하고, 마크다운으로 중요 키워드는 **강조**하세요. (리포트 요약이나 종합 결론은 이 탭에서 다루지 마세요.)`
    }
    return `키워드: "${keyword}"\n\n수집된 뉴스가 없습니다. 시장 분석은 실시간 뉴스가 있을 때 표시됩니다. 다른 탭(인사이트, 종합 리포트)을 확인해 주세요.`
  }
  if (tab === 'creative') {
    return `키워드: "${keyword}"${newsBlock}${baseSummary}위 내용을 바탕으로 향후 전망과 투자/행동 아이디어를 도출해 주세요. 실행 가능한 제안을 2~4문단으로 답하고, 마크다운으로 중요 키워드는 **강조**하세요.`
  }
  // fact
  const reportParts = [
    logicText ? `## 시장 분석\n${logicText}` : '',
    creativeText ? `## 인사이트\n${creativeText}` : '',
    summary ? `## 리포트 요약\n${summary}` : '',
    newsHeadlines ? `## 참고 뉴스 헤드라인\n${newsHeadlines}` : '',
  ].filter(Boolean)
  return `키워드: "${keyword}"\n\n아래 내용을 하나의 격식 있는 종합 리서치 보고서로 정리해 주세요. 제목, 요약, 본문(소제목과 문단), 결론 순으로 구성하고, 마지막에 'PM을 위한 우선순위별 Action Item (P0, P1, P2)' 섹션을 포함하고, 마크다운으로 중요 키워드는 **강조**하세요.\n\n${reportParts.join('\n\n')}`
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  let body: {
    keyword?: string
    summary?: string
    tab?: string
    reportId?: string
    newsHeadlines?: string
    logicText?: string
    creativeText?: string
    provider?: 'groq' | 'hf' | 'both'
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = (body?.keyword ?? '').trim()
  const summary = typeof body?.summary === 'string' ? body.summary : ''
  const tab = body?.tab as TabType | undefined
  const reportId = typeof body?.reportId === 'string' ? body.reportId : null
  const newsHeadlines = typeof body?.newsHeadlines === 'string' ? body.newsHeadlines.trim() : ''
  const logicText = typeof body?.logicText === 'string' ? body.logicText.trim() : ''
  const creativeText = typeof body?.creativeText === 'string' ? body.creativeText.trim() : ''
  const provider = body?.provider === 'groq' || body?.provider === 'hf' ? body.provider : 'both'

  if (!tab || !['logic', 'creative', 'fact'].includes(tab)) {
    return NextResponse.json({ error: 'tab must be one of logic, creative, fact' }, { status: 400 })
  }
  if (!keyword) {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  // DB 캐시 우선: research_history.analysis_groq[tab], analysis_hf[tab]
  if (reportId) {
    const { data: historyRow } = await supabase
      .from('research_history')
      .select('analysis_groq, analysis_hf')
      .eq('report_id', reportId)
      .eq('user_id', user.id)
      .maybeSingle()

    const groqTab = historyRow?.analysis_groq as Record<string, string> | null
    const hfTab = historyRow?.analysis_hf as Record<string, string> | null
    const cachedGroq = typeof groqTab?.[tab] === 'string' && groqTab[tab].trim().length > 0 ? groqTab[tab].trim() : null
    const cachedHf = typeof hfTab?.[tab] === 'string' && hfTab[tab].trim().length > 0 ? hfTab[tab].trim() : null

    const needGroq = (provider === 'both' || provider === 'groq') && !cachedGroq
    const needHf = (provider === 'both' || provider === 'hf') && !cachedHf

    if (!needGroq && !needHf) {
      return NextResponse.json({
        groq: cachedGroq != null ? { text: cachedGroq } : null,
        hf: cachedHf != null ? { text: cachedHf } : null,
      })
    }
  }

  const groqKey = process.env.GROQ_API_KEY?.trim()
  const hfKey = (process.env.HUGGINGFACE_API_KEY ?? process.env.HF_TOKEN ?? '').trim()
  if ((provider === 'both' || provider === 'groq') && !groqKey) {
    return NextResponse.json(
      { error: 'Groq API 키가 설정되지 않았습니다. GROQ_API_KEY를 설정해 주세요.' },
      { status: 400 }
    )
  }
  if ((provider === 'both' || provider === 'hf') && !hfKey) {
    return NextResponse.json(
      { error: 'Hugging Face API 키가 설정되지 않았습니다. HUGGINGFACE_API_KEY를 설정해 주세요.' },
      { status: 400 }
    )
  }

  const userPrompt = buildUserPrompt(tab, keyword, summary, newsHeadlines, logicText, creativeText)

  async function callGroq(): Promise<string | null> {
    if (provider === 'hf') return null
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content:
                "당신은 시장 리서치·비즈니스 전략·리포트 작성 전문가입니다. 요청에 맞게 마크다운으로 답변하세요. 중요 키워드는 **강조**하세요.",
            },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2048,
        }),
      })
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } }
      if (!res.ok) {
        console.warn('[Research Tab] Groq', res.status, data?.error?.message ?? data)
        return null
      }
      const text = data?.choices?.[0]?.message?.content?.trim() ?? ''
      return text || null
    } catch (e) {
      console.warn('[Research Tab] Groq', e)
      return null
    }
  }

  async function callHf(): Promise<string | null> {
    if (provider === 'groq') return null
    const maxRetries = 3
    const delays = [2000, 4000, 6000]
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const res = await fetch('https://router.huggingface.co/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${hfKey}`,
          },
          body: JSON.stringify({
            model: HF_MODEL,
            instructions: '당신은 시장 리서치·비즈니스 전략·리포트 작성 전문가입니다. 요청에 맞게 마크다운으로 답변하세요. 중요 키워드는 **강조**하세요.',
            input: userPrompt,
            max_output_tokens: 2048,
          }),
        })
        const raw = await res.text()
        const isRetryable =
          res.status === 503 ||
          res.status === 410 ||
          /loading|overloaded|traffic|트래픽|rate limit|try again/i.test(raw)
        if (!res.ok && isRetryable && attempt < maxRetries - 1) {
          console.warn('[Research Tab] HF', res.status, '재시도', attempt + 1, '/', maxRetries, raw.slice(0, 150))
          await new Promise((r) => setTimeout(r, delays[attempt]))
          continue
        }
        if (!res.ok) {
          console.warn('[Research Tab] HF', res.status, raw.slice(0, 200))
          return null
        }
        let generatedText = ''
        try {
          const data = JSON.parse(raw) as {
            output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>
          }
          const msg = data.output?.find((o) => o.type === 'message')
          const textBlock = msg?.content?.find((c) => c.type === 'output_text')
          generatedText = (textBlock?.text ?? '').trim()
        } catch {
          generatedText = raw.slice(0, 4000).trim()
        }
        return generatedText || null
      } catch (e) {
        console.warn('[Research Tab] HF', attempt + 1, e)
        if (attempt < maxRetries - 1) await new Promise((r) => setTimeout(r, delays[attempt]))
        else return null
      }
    }
    return null
  }

  const [groqText, hfText] = await Promise.all([callGroq(), callHf()])

  const groqResult = (provider === 'both' || provider === 'groq') ? (groqText ?? '') : null
  const hfResult = (provider === 'both' || provider === 'hf') ? (hfText ?? '') : null

  if (reportId && (groqResult !== null || hfResult !== null)) {
    try {
      const { data: historyRow } = await supabase
        .from('research_history')
        .select('analysis_groq, analysis_hf')
        .eq('report_id', reportId)
        .eq('user_id', user.id)
        .maybeSingle()

      const prevGroq = (historyRow?.analysis_groq as Record<string, string>) ?? {}
      const prevHf = (historyRow?.analysis_hf as Record<string, string>) ?? {}
      const nextGroq = groqResult !== null ? { ...prevGroq, [tab]: groqResult } : prevGroq
      const nextHf = hfResult !== null ? { ...prevHf, [tab]: hfResult } : prevHf

      await supabase
        .from('research_history')
        .update({
          analysis_groq: Object.keys(nextGroq).length ? nextGroq : null,
          analysis_hf: Object.keys(nextHf).length ? nextHf : null,
          updated_at: new Date().toISOString(),
        })
        .eq('report_id', reportId)
        .eq('user_id', user.id)
    } catch (e) {
      console.warn('[Research Tab] DB save', e)
    }
  }

  const hasAny = (groqResult !== null && groqResult.length > 0) || (hfResult !== null && hfResult.length > 0)
  if (!hasAny) {
    return NextResponse.json(
      { error: UNIFIED_ERROR_MESSAGE, groq: null, hf: null },
      { status: 500 }
    )
  }

  return NextResponse.json({
    groq: groqResult !== null ? { text: groqResult } : null,
    hf: hfResult !== null ? { text: hfResult } : null,
  })
}
