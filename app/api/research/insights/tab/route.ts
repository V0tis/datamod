import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveOpenAIKey } from '@/lib/license'
import OpenAI from 'openai'

/** 긴급 복구: 모든 탭에서 비용 효율적인 gpt-4o-mini로 일시 통합 */
const TAB_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? 'gpt-4o-mini'
const UNIFIED_ERROR_MESSAGE = '현재 모든 AI 엔진의 트래픽이 높습니다. 잠시 후 다시 시도해 주세요.'

export type TabType = 'logic' | 'creative' | 'fact'

const TAB_SYSTEM_PROMPTS: Record<TabType, string> = {
  logic:
    "당신은 시장 리서치와 전략 분석 전문가 '린'입니다. **RSS 뉴스의 핵심 내용**과 **트렌드 지표**를 분석해주세요. 제공된 실시간 뉴스 헤드라인을 반드시 참고하여 시장성·타겟 고객·검색량 추이를 2~4문단으로 답변하세요. 마크다운 형식, 중요 키워드는 **강조**.",
  creative:
    "당신은 비즈니스 전략 전문가 '린'입니다. **비즈니스적 통찰**과 **구체적인 Action Item**을 도출해주세요. 실행 가능한 제안을 2~4문단으로 답변하세요. 마크다운 형식, 중요 키워드는 **강조**.",
  fact:
    "당신은 리서치 보고서 작성 전문가 '린'입니다. 아래 시장 분석·인사이트·데이터를 하나로 통합하여 **격식 있는 전문가 리서치 보고서** 형식으로 작성해주세요. 제목, 요약, 본문(소제목과 문단), 결론 순으로 구성하고, 객관적 톤을 유지하세요. **마지막에 반드시 'PM을 위한 우선순위별 Action Item (P0, P1, P2)' 섹션을 포함**해주세요. P0=즉시 실행, P1=단기, P2=중장기로 구분하고 각 항목을 구체적으로 나열하세요. 마크다운 형식, 중요 키워드는 **강조**.",
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
    .select('openai_api_key')
    .eq('user_id', user.id)
    .maybeSingle()
  const openaiKey = getEffectiveOpenAIKey((row as { openai_api_key?: string })?.openai_api_key)

  let body: { keyword?: string; summary?: string; tab?: string; reportId?: string; newsHeadlines?: string; logicText?: string; creativeText?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const keyword = body?.keyword ?? ''
  const summary = typeof body?.summary === 'string' ? body.summary : ''
  const tab = body?.tab as TabType | undefined
  const reportId = typeof body?.reportId === 'string' ? body.reportId : null
  const newsHeadlines = typeof body?.newsHeadlines === 'string' ? body.newsHeadlines.trim() : ''
  const logicText = typeof body?.logicText === 'string' ? body.logicText.trim() : ''
  const creativeText = typeof body?.creativeText === 'string' ? body.creativeText.trim() : ''

  if (!tab || !TAB_SYSTEM_PROMPTS[tab]) {
    return NextResponse.json({ error: 'tab must be one of logic, creative, fact' }, { status: 400 })
  }
  if (!keyword || typeof keyword !== 'string') {
    return NextResponse.json({ error: 'keyword required' }, { status: 400 })
  }

  // 이미 DB에 해당 탭 분석 결과가 있으면 API 호출 없이 즉시 반환
  if (reportId) {
    const { data: report } = await supabase
      .from('reports')
      .select('user_id, ai_responses')
      .eq('id', reportId)
      .single()
    if (report?.user_id === user.id && report?.ai_responses) {
      const cached = (report.ai_responses as Record<string, string>)[tab]
      if (typeof cached === 'string' && cached.trim().length > 0) {
        return NextResponse.json({ text: cached.trim() })
      }
    }
  }

  if (!openaiKey) {
    console.warn('[Research Insights Tab API] OpenAI API 키 없음: 사용자 설정 또는 서버 env 확인')
    return NextResponse.json(
      { error: '분석을 사용하려면 설정에서 OpenAI API 키를 등록해 주세요.' },
      { status: 400 }
    )
  }

  const systemInstruction = TAB_SYSTEM_PROMPTS[tab]
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인:\n${newsHeadlines}\n\n` : ''

  async function saveToReport(text: string) {
    if (!reportId) return
    try {
      const { data: report } = await supabase.from('reports').select('user_id, ai_responses').eq('id', reportId).single()
      if (report?.user_id === user.id) {
        const current = (report.ai_responses as Record<string, string>) ?? {}
        const { error } = await supabase.from('reports').update({ ai_responses: { ...current, [tab]: text } }).eq('id', reportId)
        if (error) console.warn('[Research Insights Tab] DB 저장 실패(컬럼 확인):', error.message)
      }
    } catch (e) {
      console.warn('[Research Insights Tab] saveToReport:', e)
    }
  }

  const openai = new OpenAI({ apiKey: openaiKey })

  async function callOpenAI(userPrompt: string, maxTokens = 1500): Promise<NextResponse> {
    try {
      const completion = await openai.chat.completions.create({
        model: TAB_MODEL,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
      })
      const text = (completion.choices[0]?.message?.content ?? '').trim() || '분석 결과를 생성하지 못했어요.'
      await saveToReport(text)
      return NextResponse.json({ text })
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e)
      const code = (e as { code?: string })?.code ?? ''
      const isQuota = /429|quota|insufficient_quota|rate limit/i.test(msg) || code === 'insufficient_quota'
      if (isQuota) {
        console.warn('[Research Insights Tab API] OpenAI 잔액/쿼터 부족:', msg)
      } else {
        console.warn('[Research Insights Tab API] OpenAI 호출 실패 (키 확인 또는 네트워크):', msg)
      }
      return NextResponse.json(
        { error: UNIFIED_ERROR_MESSAGE, code: isQuota ? 'QUOTA' : undefined },
        { status: isQuota ? 429 : 500 }
      )
    }
  }

  if (tab === 'fact') {
    const reportParts = [
      logicText ? `## 시장 분석\n${logicText}` : '',
      creativeText ? `## 인사이트\n${creativeText}` : '',
      summary ? `## 리포트 요약\n${summary}` : '',
      newsHeadlines ? `## 참고 뉴스 헤드라인\n${newsHeadlines}` : '',
    ].filter(Boolean)
    const reportPrompt = `키워드: "${keyword}"\n\n아래 내용을 하나의 격식 있는 리서치 보고서로 통합해 주세요.\n\n${reportParts.join('\n\n')}`
    return callOpenAI(reportPrompt, 2000)
  }

  if (tab === 'creative') {
    const baseSummary = summary ? `리포트 요약:\n${summary}` : ''
    const userPrompt = `키워드: "${keyword}"${newsBlock}${baseSummary ? baseSummary + '\n\n' : ''}위 내용을 바탕으로 비즈니스 통찰과 실행 가능한 Action Item을 제안해 주세요.`
    return callOpenAI(userPrompt)
  }

  if (tab === 'logic') {
    const baseSummary = summary ? `리포트 요약:\n${summary}` : ''
    const userPrompt = newsBlock
      ? `키워드: "${keyword}"${newsBlock}${baseSummary ? baseSummary + '\n\n' : ''}위 실시간 뉴스와 요약을 바탕으로 시장성·타겟 고객·검색량 추이를 분석해 주세요.`
      : baseSummary
        ? `키워드: "${keyword}"\n\n${baseSummary}\n\n위 요약을 바탕으로 시장 분석해 주세요.`
        : `키워드: "${keyword}"\n\n이 키워드/이슈에 대해 시장 분석해 주세요.`
    return callOpenAI(userPrompt)
  }

  return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
}
