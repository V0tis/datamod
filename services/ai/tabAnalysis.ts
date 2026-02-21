/**
 * Single responsibility: run Groq and/or Gemini for tab insight (logic/creative/fact).
 * Isolates AI communication; routes handle cache, DB, and consensus.
 * @deprecated Prefer using lib/ai/unified-ai-service.ts runTabAnalysis for new code.
 */
import { sleep, REQUEST_GAP_MS } from '@/lib/gemini-retry'
import { requestGenerateContent, parseGenerateContentResponse, getTabModel } from '@/services/ai/geminiClient'
import { completeChat } from '@/services/ai/groqClient'

export type TabAnalysisProvider = 'groq' | 'gemini' | 'all'

export type TabAnalysisInput = {
  groqKey: string | null
  geminiKey: string | null
  provider: TabAnalysisProvider
  systemPrompt: string
  userPrompt: string
}

export type TabAnalysisResult = {
  groqText: string | null
  geminiText: string | null
  groqQuotaError: boolean
  geminiQuotaExceeded: boolean
}

/**
 * Call Groq and/or Gemini with the given prompts. Sequential: Groq then (after gap) Gemini when provider is 'all'.
 * Returns raw text from each provider; quota errors are reported in the result, not thrown.
 */
export async function runTabAnalysis(input: TabAnalysisInput): Promise<TabAnalysisResult> {
  const { groqKey, geminiKey, provider, systemPrompt, userPrompt } = input

  const needGroq = provider === 'all' || provider === 'groq'
  const needGemini = provider === 'all' || provider === 'gemini'

  async function callGroq(): Promise<{ text: string | null; quotaError?: boolean }> {
    if (!needGroq || !groqKey) return { text: null }
    const result = await completeChat(groqKey, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])
    return {
      text: result.text ?? null,
      quotaError: result.quotaError === true,
    }
  }

  async function callGemini(): Promise<{ text: string | null; quotaExceeded?: boolean }> {
    if (!needGemini || !geminiKey) return { text: null }
    const body = {
      contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: 2048 },
    }
    try {
      const res = await requestGenerateContent(geminiKey, body, getTabModel())
      const data = (await res.json().catch(() => ({}))) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      }
      if (!res.ok) {
        return res.status === 429 ? { text: null, quotaExceeded: true } : { text: null }
      }
      const text = parseGenerateContentResponse(data)
      return { text: text || null }
    } catch (e) {
      const is429 = (e as { status?: number })?.status === 429
      return { text: null, quotaExceeded: is429 }
    }
  }

  let groqPayload: { text: string | null; quotaError?: boolean }
  let geminiPayload: { text: string | null; quotaExceeded?: boolean }

  if (needGroq && needGemini) {
    groqPayload = await callGroq()
    await sleep(REQUEST_GAP_MS)
    geminiPayload = await callGemini()
  } else if (needGroq) {
    groqPayload = await callGroq()
    geminiPayload = { text: null }
  } else if (needGemini) {
    geminiPayload = await callGemini()
    groqPayload = { text: null }
  } else {
    groqPayload = { text: null }
    geminiPayload = { text: null }
  }

  return {
    groqText: groqPayload.text,
    geminiText: geminiPayload.text,
    groqQuotaError: groqPayload.quotaError === true,
    geminiQuotaExceeded: geminiPayload.quotaExceeded === true,
  }
}
