import type { SupabaseClient } from '@supabase/supabase-js'
import { GEMINI_MODEL, GEMINI_LONG_CONTEXT_MODEL } from '@/lib/gemini-config'
import { generateTextWithUsage } from '@/services/ai/geminiClient'
import { completeChat as groqCompleteChat } from '@/services/ai/groqClient'
import {
  is429OrQuotaError,
  isFallbackTriggerError,
  getFallbackErrorReason,
  sleep,
  getExponentialDelayMs,
} from '@/lib/ai/retry-with-backoff'
import {
  estimatePromptTokens,
  shouldForceGeminiLongContext,
  getLongContextGeminiModel,
} from '@/lib/ai/context-routing'
import { recordLlmUsage } from '@/lib/llm-usage-record'

const AI_BASE_DELAY_MS = 1000
const AI_MAX_RETRIES = 2

export type PipelinePrimaryModel = 'gemini' | 'groq'

export type LlmRecordingContext = {
  supabase: SupabaseClient
  userId: string
  analysisId: string
}

export type PipelineTextResult = {
  text: string
  usedFallback: boolean
  primaryProviderError?: string
  longContextRoute?: boolean
}

async function safeRecord(
  ctx: LlmRecordingContext | undefined,
  row: {
    stepName: string
    provider: 'gemini' | 'groq'
    model: string
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
    fallbackUsed: boolean
    longContextRoute?: boolean
  }
) {
  if (!ctx) return
  await recordLlmUsage(ctx.supabase, {
    userId: ctx.userId,
    analysisId: ctx.analysisId,
    stepName: row.stepName,
    provider: row.provider,
    model: row.model,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    fallbackUsed: row.fallbackUsed,
    longContextRoute: row.longContextRoute ?? false,
  })
}

/**
 * 분석 파이프라인 공통: (1) 입력이 매우 길면 Gemini Long Context 고정 (2) 그 외 우선 모델 → 실패 시 상대 모델 폴백.
 */
export async function runPipelineGeminiGroqText(options: {
  step: string
  geminiKey: string
  groqKey: string | null | undefined
  primaryProvider: PipelinePrimaryModel
  systemInstruction: string
  prompt: string
  maxOutputTokens: number
  groqMaxTokens?: number
  geminiModel?: string
  ctx?: LlmRecordingContext
}): Promise<PipelineTextResult> {
  const {
    step,
    geminiKey,
    groqKey,
    primaryProvider,
    systemInstruction,
    prompt,
    maxOutputTokens,
    groqMaxTokens = maxOutputTokens,
    geminiModel = GEMINI_MODEL,
    ctx,
  } = options

  const est = estimatePromptTokens(systemInstruction, prompt)
  if (shouldForceGeminiLongContext(est)) {
    const longModel = getLongContextGeminiModel()
    const r = await generateTextWithUsage({
      apiKey: geminiKey,
      prompt,
      systemInstruction,
      maxOutputTokens,
      model: longModel,
      isRetryable: () => false,
    })
    await safeRecord(ctx, {
      stepName: step,
      provider: 'gemini',
      model: longModel,
      promptTokens: r.promptTokenCount,
      completionTokens: r.candidatesTokenCount,
      totalTokens: r.totalTokenCount,
      fallbackUsed: false,
      longContextRoute: true,
    })
    return { text: r.text ?? '', usedFallback: false, longContextRoute: true }
  }

  const primaryIsGemini = primaryProvider === 'gemini'
  /** PM 액션 플랜: Groq 재시도 없이 빠르게 Gemini Flash 폴백 */
  const maxPrimaryRetries = step === 'execution_layer' && !primaryIsGemini ? 0 : AI_MAX_RETRIES
  let usedFallback = false
  let primaryProviderError: string | undefined

  const messages = [
    { role: 'system' as const, content: systemInstruction },
    { role: 'user' as const, content: prompt },
  ]

  for (let attempt = 0; attempt <= maxPrimaryRetries; attempt++) {
    try {
      if (primaryIsGemini) {
        const r = await generateTextWithUsage({
          apiKey: geminiKey,
          prompt,
          systemInstruction,
          maxOutputTokens,
          model: geminiModel,
          isRetryable: () => false,
        })
        const text = r.text ?? ''
        await safeRecord(ctx, {
          stepName: step,
          provider: 'gemini',
          model: r.model,
          promptTokens: r.promptTokenCount,
          completionTokens: r.candidatesTokenCount,
          totalTokens: r.totalTokenCount,
          fallbackUsed: false,
        })
        return { text, usedFallback: false }
      }
      if (!groqKey) throw new Error('Groq key not available')
      const groqRes = await groqCompleteChat(groqKey, messages, { maxTokens: groqMaxTokens })
      /** 빈 응답·쿼터는 폴백 트리거로 던져야 Gemini로 이어짐 (제네릭 'Groq failed'는 isFallbackTriggerError 미통과) */
      if (groqRes.quotaError) {
        const q = new Error('429 Groq rate limit or quota') as Error & { status?: number }
        q.status = 429
        throw q
      }
      if (!groqRes.text?.trim()) {
        throw new Error('network error: Groq returned empty output')
      }
      const text = groqRes.text
      await safeRecord(ctx, {
        stepName: step,
        provider: 'groq',
        model: groqRes.model ?? 'groq',
        promptTokens: groqRes.usage?.prompt_tokens,
        completionTokens: groqRes.usage?.completion_tokens,
        totalTokens: groqRes.usage?.total_tokens,
        fallbackUsed: false,
      })
      return { text, usedFallback: false }
    } catch (err) {
      if (attempt < maxPrimaryRetries && is429OrQuotaError(err)) {
        await sleep(getExponentialDelayMs(attempt, AI_BASE_DELAY_MS))
        continue
      }
      if (isFallbackTriggerError(err)) {
        primaryProviderError = getFallbackErrorReason(err)
        try {
          if (primaryIsGemini && groqKey) {
            const groqRes = await groqCompleteChat(groqKey, messages, { maxTokens: groqMaxTokens })
            if (groqRes.quotaError) {
              const q = new Error('429 Groq rate limit or quota') as Error & { status?: number }
              q.status = 429
              throw q
            }
            if (!groqRes.text?.trim()) {
              throw new Error('network error: Groq fallback returned empty output')
            }
            const text = groqRes.text
            usedFallback = true
            await safeRecord(ctx, {
              stepName: step,
              provider: 'groq',
              model: groqRes.model ?? 'groq',
              promptTokens: groqRes.usage?.prompt_tokens,
              completionTokens: groqRes.usage?.completion_tokens,
              totalTokens: groqRes.usage?.total_tokens,
              fallbackUsed: true,
            })
            return { text, usedFallback: true, primaryProviderError }
          }
          if (!primaryIsGemini) {
            const geminiFallbackModel = step === 'execution_layer' ? GEMINI_LONG_CONTEXT_MODEL : geminiModel
            const r = await generateTextWithUsage({
              apiKey: geminiKey,
              prompt,
              systemInstruction,
              maxOutputTokens,
              model: geminiFallbackModel,
              isRetryable: () => false,
            })
            const textGem = r.text ?? ''
            usedFallback = true
            await safeRecord(ctx, {
              stepName: step,
              provider: 'gemini',
              model: r.model,
              promptTokens: r.promptTokenCount,
              completionTokens: r.candidatesTokenCount,
              totalTokens: r.totalTokenCount,
              fallbackUsed: true,
            })
            return { text: textGem, usedFallback: true, primaryProviderError }
          }
        } catch {
          throw err
        }
        throw err
      }
      throw err
    }
  }

  throw new Error('LLM 텍스트 생성에 실패했습니다.')
}
