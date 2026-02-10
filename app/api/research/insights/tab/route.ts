import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveLicenseKeys } from '@/lib/license'
import { GoogleGenerativeAI } from '@google/generative-ai'

/** 무료 티어: Gemini 1.5 Flash */
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash'
const UNIFIED_ERROR_MESSAGE = '현재 AI 엔진 트래픽이 높습니다. 잠시 후 다시 시도해 주세요.'

export type TabType = 'logic' | 'creative' | 'fact'

/** 탭별 시스템 프롬프트: 시장 분석 / 인사이트 / 종합 리포트 */
const TAB_SYSTEM_PROMPTS: Record<TabType, string> = {
  logic:
    "당신은 시장 리서치 전문가 '린'입니다. **제공된 실시간 뉴스 제목들**을 반드시 참고하여, 해당 키워드에 대한 **뉴스 기반 실시간 상황 요약문**을 2~4문단으로 작성해 주세요. 시장성·타겟·검색량 추이를 포함하고, 마크다운 형식으로 중요 키워드는 **강조**하세요.",
  creative:
    "당신은 비즈니스 전략 전문가 '린'입니다. 제공된 뉴스·요약을 바탕으로 **향후 전망**과 **투자/행동 아이디어**를 도출해 주세요. 실행 가능한 제안을 2~4문단으로 답변하고, 마크다운 형식으로 중요 키워드는 **강조**하세요.",
  fact:
    "당신은 리서치 보고서 작성 전문가 '린'입니다. 아래 시장 분석·인사이트·데이터를 **하나의 문서 형태로 정리**한 **종합 리포트**를 작성해 주세요. 제목, 요약, 본문(소제목과 문단), 결론 순으로 구성하고, 객관적 톤을 유지하세요. 마지막에 'PM을 위한 우선순위별 Action Item (P0, P1, P2)' 섹션을 포함하고, 마크다운 형식으로 중요 키워드는 **강조**하세요.",
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
  const userGemini = (row as { gemini_api_key?: string } | null)?.gemini_api_key ?? null
  const effective = getEffectiveLicenseKeys(userGemini)

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

  if (!effective.canSearch || !effective.gemini) {
    return NextResponse.json(
      { error: '분석을 사용하려면 설정에서 Gemini API 키를 등록해 주세요.' },
      { status: 400 }
    )
  }

  const systemInstruction = TAB_SYSTEM_PROMPTS[tab]
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인 (news_items_ko):\n${newsHeadlines}\n\n` : ''

  async function saveToReport(text: string) {
    if (!reportId) return
    try {
      const { data: report } = await supabase.from('reports').select('user_id, ai_responses').eq('id', reportId).single()
      if (report?.user_id === user.id) {
        const current = (report.ai_responses as Record<string, string>) ?? {}
        const { error } = await supabase.from('reports').update({ ai_responses: { ...current, [tab]: text } }).eq('id', reportId)
        if (error) console.warn('[Research Insights Tab] DB 저장 실패:', error.message)
        const column = tab === 'logic' ? 'analysis_market' : tab === 'creative' ? 'analysis_insight' : 'analysis_report'
        await supabase
          .from('research_history')
          .update({ [column]: text, updated_at: new Date().toISOString() })
          .eq('report_id', reportId)
      }
    } catch (e) {
      console.warn('[Research Insights Tab] saveToReport:', e)
    }
  }

  const genAI = new GoogleGenerativeAI(effective.gemini)
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction,
    generationConfig: { maxOutputTokens: 2048 },
  })

  async function callGemini(userPrompt: string): Promise<NextResponse> {
    try {
      const result = await model.generateContent(userPrompt)
      const text = (result.response.text() ?? '').trim() || '분석 결과를 생성하지 못했어요.'
      await saveToReport(text)
      return NextResponse.json({ text })
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? e)
      const isQuota = /429|quota|resource exhausted|rate limit/i.test(msg)
      if (isQuota) {
        console.warn('[Research Insights Tab API] Gemini 쿼터/429:', msg)
      } else {
        console.warn('[Research Insights Tab API] Gemini 호출 실패:', msg)
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
    const reportPrompt = `키워드: "${keyword}"\n\n아래 내용을 하나의 격식 있는 종합 리서치 보고서로 정리해 주세요.\n\n${reportParts.join('\n\n')}`
    return callGemini(reportPrompt)
  }

  if (tab === 'creative') {
    const baseSummary = summary ? `리포트 요약:\n${summary}` : ''
    const userPrompt = `키워드: "${keyword}"${newsBlock}${baseSummary ? baseSummary + '\n\n' : ''}위 내용을 바탕으로 향후 전망과 투자/행동 아이디어를 제안해 주세요.`
    return callGemini(userPrompt)
  }

  if (tab === 'logic') {
    const baseSummary = summary ? `리포트 요약:\n${summary}` : ''
    const userPrompt = newsBlock
      ? `키워드: "${keyword}"${newsBlock}${baseSummary ? baseSummary + '\n\n' : ''}위 실시간 뉴스(제목)와 요약을 바탕으로 뉴스 기반 실시간 상황 요약문을 작성해 주세요.`
      : baseSummary
        ? `키워드: "${keyword}"\n\n${baseSummary}\n\n위 요약을 바탕으로 시장 분석(실시간 상황 요약)을 해 주세요.`
        : `키워드: "${keyword}"\n\n이 키워드에 대한 시장 분석(실시간 상황 요약)을 해 주세요.`
    return callGemini(userPrompt)
  }

  return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
}
