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
import { extractGemini429RetryDelayMs } from '@/lib/ai/gemini-quota-error'
import { completeAnthropicMessages } from '@/services/ai/anthropicClient'
import {
  estimatePromptTokens,
  shouldForceGeminiLongContext,
  getLongContextGeminiModel,
} from '@/lib/ai/context-routing'
import { recordLlmUsage } from '@/lib/llm-usage-record'
import { summarizeUserPromptForPmActionGemini } from '@/lib/ai/pm-action-groq-recovery'
import { compressTextForPmActionInput } from '@/lib/ai/pipeline-prompts'

/** Gemini 429 재시도: 최소 5초대 지수 백오프(즉시 재호출 방지) */
const AI_BASE_DELAY_MS = 5000
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
  /** strategy_generation 전용: Groq 실패 시 Claude(Anthropic) 3차 폴백 */
  anthropicKey?: string | null
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
    anthropicKey,
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
  /**
   * 전략 단계: Gemini 쿼터(429) 시 대기 없이 Groq로 넘기기 위해 Gemini 쪽 재시도 루프를 생략.
   * PM 액션(Groq 우선): Groq 재시도 없이 빠르게 Gemini 폴백.
   */
  const maxPrimaryRetries =
    step === 'strategy_generation' && primaryIsGemini && groqKey?.trim()
      ? 0
      : step === 'execution_layer' && !primaryIsGemini
        ? 0
        : AI_MAX_RETRIES
  let usedFallback = false
  let primaryProviderError: string | undefined

  const buildMessages = (userContent: string) => [
    { role: 'system' as const, content: systemInstruction },
    { role: 'user' as const, content: userContent },
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
      let userContent = prompt
      let groqRes = await groqCompleteChat(groqKey, buildMessages(userContent), { maxTokens: groqMaxTokens })
      if (groqRes.payloadTooLarge && step === 'execution_layer') {
        console.warn('[pipeline] Groq 413 on execution_layer: shrinking input, then retrying Groq')
        userContent = geminiKey
          ? await summarizeUserPromptForPmActionGemini(geminiKey, prompt)
          : compressTextForPmActionInput(prompt, 8000)
        groqRes = await groqCompleteChat(groqKey, buildMessages(userContent), { maxTokens: groqMaxTokens })
      }
      if (groqRes.payloadTooLarge && step === 'execution_layer') {
        userContent = compressTextForPmActionInput(userContent, 6000)
        console.warn('[pipeline] Groq still 413: hard-truncating user prompt to 6000 chars')
        groqRes = await groqCompleteChat(groqKey, buildMessages(userContent), { maxTokens: groqMaxTokens })
      }
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
        const serverMs = extractGemini429RetryDelayMs(err)
        const exp = getExponentialDelayMs(attempt, AI_BASE_DELAY_MS)
        await sleep(serverMs > 0 ? Math.max(exp, serverMs) : exp)
        continue
      }
      if (isFallbackTriggerError(err)) {
        primaryProviderError = getFallbackErrorReason(err)
        try {
          if (primaryIsGemini && groqKey) {
            const groqRes = await groqCompleteChat(groqKey, buildMessages(prompt), { maxTokens: groqMaxTokens })
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
          if (
            step === 'strategy_generation' &&
            primaryIsGemini &&
            typeof anthropicKey === 'string' &&
            anthropicKey.trim().length > 0
          ) {
            try {
              const ar = await completeAnthropicMessages(anthropicKey.trim(), systemInstruction, prompt, {
                maxTokens: groqMaxTokens,
              })
              if (ar.text?.trim()) {
                const note = `${primaryProviderError ?? 'primary failed'}; groq fallback failed; anthropic`
                return { text: ar.text.trim(), usedFallback: true, primaryProviderError: note }
              }
            } catch {
              /* fall through */
            }
          }
          throw err
        }
        throw err
      }
      throw err
    }
  }

  throw new Error('LLM 텍스트 생성에 실패했습니다.')
}
