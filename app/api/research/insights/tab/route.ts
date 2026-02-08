import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveLicenseKeys, getEffectiveOpenAIKey, getEffectiveAnthropicKey } from '@/lib/license'
import { GoogleGenerativeAI } from '@google/generative-ai'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-1.5-flash-latest'
const OPENAI_REPORT_MODEL = process.env.OPENAI_FALLBACK_MODEL ?? 'gpt-4o-mini'
const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022'
const MAX_RETRIES = 3

export type TabType = 'logic' | 'creative' | 'fact'

const TAB_SYSTEM_PROMPTS: Record<TabType, string> = {
  logic:
    "당신은 시장 리서치와 전략 분석 전문가 '린'입니다. **RSS 뉴스의 핵심 내용**과 **트렌드 지표**를 분석해주세요. 제공된 실시간 뉴스 헤드라인을 반드시 참고하여 시장성·타겟 고객·검색량 추이를 2~4문단으로 답변하세요. 마크다운 형식, 중요 키워드는 **강조**.",
  creative:
    "당신은 비즈니스 전략 전문가 '린'입니다. **비즈니스적 통찰**과 **구체적인 Action Item**을 도출해주세요. 실행 가능한 제안을 2~4문단으로 답변하세요. 마크다운 형식, 중요 키워드는 **강조**.",
  fact:
    "당신은 리서치 보고서 작성 전문가 '린'입니다. 아래 시장 분석·인사이트·데이터를 하나로 통합하여 **격식 있는 전문가 리서치 보고서** 형식으로 작성해주세요. 제목, 요약, 본문(소제목과 문단), 결론 순으로 구성하고, 객관적 톤을 유지하세요. **마지막에 반드시 'PM을 위한 Next Steps (P0, P1, P2)' 섹션을 고정**해주세요. P0=즉시 실행, P1=단기, P2=중장기로 구분하고 각 항목을 구체적으로 나열하세요. 마크다운 형식, 중요 키워드는 **강조**.",
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
    .select('gemini_api_key, openai_api_key, anthropic_api_key')
    .eq('user_id', user.id)
    .maybeSingle()
  const effective = getEffectiveLicenseKeys(row?.gemini_api_key ?? null)
  const openaiKey = getEffectiveOpenAIKey(row?.openai_api_key)
  const anthropicKey = getEffectiveAnthropicKey((row as { anthropic_api_key?: string })?.anthropic_api_key)
  const geminiKey = effective.gemini

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

  const systemInstruction = TAB_SYSTEM_PROMPTS[tab]
  const newsBlock = newsHeadlines ? `\n\n실시간 뉴스 헤드라인:\n${newsHeadlines}\n\n` : ''

  async function saveToReport(text: string) {
    if (!reportId) return
    const { data: report } = await supabase.from('reports').select('user_id, ai_responses').eq('id', reportId).single()
    if (report?.user_id === user.id) {
      const current = (report.ai_responses as Record<string, string>) ?? {}
      await supabase.from('reports').update({ ai_responses: { ...current, [tab]: text } }).eq('id', reportId)
    }
  }

  // —— 3번 탭: 분석 리포트 (GPT-4o-mini 전용) ——
  if (tab === 'fact') {
    if (!openaiKey) {
      return NextResponse.json({ error: '분석 리포트를 사용하려면 OpenAI API 키를 설정해 주세요.' }, { status: 400 })
    }
    const reportParts = [
      logicText ? `## 시장 분석\n${logicText}` : '',
      creativeText ? `## 인사이트\n${creativeText}` : '',
      summary ? `## 리포트 요약\n${summary}` : '',
      newsHeadlines ? `## 참고 뉴스 헤드라인\n${newsHeadlines}` : '',
    ].filter(Boolean)
    const reportPrompt = `키워드: "${keyword}"\n\n아래 내용을 하나의 격식 있는 리서치 보고서로 통합해 주세요.\n\n${reportParts.join('\n\n')}`
    try {
      const openai = new OpenAI({ apiKey: openaiKey })
      const completion = await openai.chat.completions.create({
        model: OPENAI_REPORT_MODEL,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: reportPrompt },
        ],
        max_tokens: 2000,
      })
      const text = (completion.choices[0]?.message?.content ?? '').trim() || '분석 결과를 생성하지 못했어요.'
      await saveToReport(text)
      return NextResponse.json({ text })
    } catch (err) {
      console.error('[Research Insights Tab API] fact (OpenAI) failed:', err)
      return NextResponse.json(
        { error: '분석 리포트 생성 중 오류가 발생했어요.' },
        { status: 500 }
      )
    }
  }

  // —— 2번 탭: 인사이트 (Claude 3.5 Sonnet 우선, 실패 시 GPT-4o-mini) ——
  if (tab === 'creative') {
    const baseSummary = summary ? `리포트 요약:\n${summary}` : ''
    const userPrompt = `키워드: "${keyword}"${newsBlock}${baseSummary ? baseSummary + '\n\n' : ''}위 내용을 바탕으로 비즈니스 통찰과 실행 가능한 Action Item을 제안해 주세요.`
    if (anthropicKey) {
      let lastErr: unknown = null
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const anthropic = new Anthropic({ apiKey: anthropicKey })
          const msg = await anthropic.messages.create({
            model: CLAUDE_MODEL,
            max_tokens: 1500,
            system: systemInstruction,
            messages: [{ role: 'user', content: userPrompt }],
          })
          const textBlock = msg.content.find((b): b is { type: 'text'; text: string } => b.type === 'text')
          const text = (textBlock?.text ?? '').trim() || '분석 결과를 생성하지 못했어요.'
          await saveToReport(text)
          return NextResponse.json({ text })
        } catch (err) {
          lastErr = err
          const msg = String((err as { message?: string })?.message ?? err)
          const is429 = /429|quota|resource exhausted|rate limit/i.test(msg)
          if (is429 && attempt < MAX_RETRIES) {
            const waitSec = Math.min(2 * Math.pow(2, attempt), 60)
            await new Promise((r) => setTimeout(r, waitSec * 1000))
            continue
          }
          break
        }
      }
    }
    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey })
        const completion = await openai.chat.completions.create({
          model: OPENAI_REPORT_MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
        })
        const text = (completion.choices[0]?.message?.content ?? '').trim() || '분석 결과를 생성하지 못했어요.'
        await saveToReport(text)
        return NextResponse.json({ text })
      } catch (e) {
        console.error('[Research Insights Tab API] creative OpenAI fallback failed:', e)
      }
    }
    return NextResponse.json(
      { error: '인사이트를 사용하려면 Claude 또는 OpenAI API 키를 설정해 주세요.' },
      { status: 400 }
    )
  }

  // —— 1번 탭: 시장 분석 (Gemini 1.5 Flash, 404/429 등 실패 시 즉시 GPT-4o-mini Fallback) ——
  if (tab === 'logic') {
    const baseSummary = summary ? `리포트 요약:\n${summary}` : ''
    const userPrompt = newsBlock
      ? `키워드: "${keyword}"${newsBlock}${baseSummary ? baseSummary + '\n\n' : ''}위 실시간 뉴스와 요약을 바탕으로 시장성·타겟 고객·검색량 추이를 분석해 주세요.`
      : baseSummary
        ? `키워드: "${keyword}"\n\n${baseSummary}\n\n위 요약을 바탕으로 시장 분석해 주세요.`
        : `키워드: "${keyword}"\n\n이 키워드/이슈에 대해 시장 분석해 주세요.`

    const runGemini = async (): Promise<{ text: string } | null> => {
      if (!geminiKey) return null
      try {
        const genAI = new GoogleGenerativeAI(geminiKey)
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL, systemInstruction })
        const result = await model.generateContent(userPrompt)
        const text = (result.response.text() || '').trim() || '분석 결과를 생성하지 못했어요.'
        return { text }
      } catch (err) {
        const msg = String((err as { message?: string })?.message ?? err)
        const is404 = /404|not found|invalid model/i.test(msg)
        const is429 = /429|quota|resource exhausted|rate limit/i.test(msg)
        if (is404) {
          console.warn('[Research Insights Tab API] Gemini 404/모델 오류, Fallback으로 전환:', msg)
          return null
        }
        if (is429) throw err
        console.warn('[Research Insights Tab API] Gemini 오류, Fallback으로 전환:', msg)
        return null
      }
    }

    let geminiResult: { text: string } | null = null
    let lastErr: unknown = null
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        geminiResult = await runGemini()
        if (geminiResult) break
        lastErr = null
        break
      } catch (err) {
        lastErr = err
        const msg = String((err as { message?: string })?.message ?? err)
        const is429 = /429|quota|resource exhausted|rate limit/i.test(msg)
        if (is429 && attempt < MAX_RETRIES) {
          const waitSec = getRetryDelaySeconds(err) > 0 ? getRetryDelaySeconds(err) : Math.min(2 * Math.pow(2, attempt), 60)
          await new Promise((r) => setTimeout(r, waitSec * 1000))
          continue
        }
        break
      }
    }

    if (geminiResult) {
      await saveToReport(geminiResult.text)
      return NextResponse.json({ text: geminiResult.text })
    }

    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey })
        const completion = await openai.chat.completions.create({
          model: OPENAI_REPORT_MODEL,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1500,
        })
        const text = (completion.choices[0]?.message?.content ?? '').trim() || '분석 결과를 생성하지 못했어요.'
        await saveToReport(text)
        return NextResponse.json({ text, fallback: true })
      } catch (e) {
        console.error('[Research Insights Tab API] logic OpenAI fallback failed:', e)
      }
    }

    const is429 = lastErr && /429|quota|rate limit/i.test(String((lastErr as { message?: string })?.message ?? lastErr))
    if (is429) {
      return NextResponse.json(
        { error: '현재 구글 엔진의 요청이 많아 잠시 후 다시 시도해 주세요.', code: 'QUOTA' },
        { status: 429 }
      )
    }
    return NextResponse.json(
      { error: '분석 중 오류가 발생했어요. 설정에서 Gemini 또는 OpenAI API 키를 확인해 주세요.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
}
