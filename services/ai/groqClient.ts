/**
 * Groq chat completion for research tab insight (logic/creative/fact).
 * Single responsibility: send messages, return text or quota error.
 * @deprecated Prefer using lib/ai for new code. Will be merged into lib/ai/providers.
 */
import { withExponentialBackoff } from '@/lib/gemini-retry'
import { fetchWithTimeout, AI_FALLBACK_MESSAGES, AI_MAX_RETRIES } from '@/lib/ai/safe-fetch'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'
const DEFAULT_MAX_TOKENS = 2048
const GROQ_TIMEOUT_MS = 60_000

export type GroqMessage = { role: 'system' | 'user'; content: string }

export type CompleteChatOptions = {
  model?: string
  maxTokens?: number
}

export type CompleteChatResult = {
  text: string | null
  quotaError?: boolean
  /** 요청 본문이 컨텍스트 한도를 초과한 경우(Groq 413 등). 상위에서 입력 요약 후 재시도 가능 */
  payloadTooLarge?: boolean
  httpStatus?: number
  /** Fallback message when AI fails (for UI display) */
  fallbackMessage?: string
  /** OpenAI-compatible usage when present */
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  /** Resolved model id for logging */
  model?: string
}

function isGroqTransientError(e: unknown): boolean {
  const s = (e as { status?: number })?.status
  if (s === 429) return true
  if (typeof s === 'number' && s >= 500 && s < 600) return true
  return false
}

/**
 * Call Groq chat completions with timeout, retry (max 2), and safe parsing.
 * 429·5xx는 지수 백오프로 재시도. 413은 재시도하지 않으며 payloadTooLarge로 반환.
 */
export async function completeChat(
  apiKey: string,
  messages: GroqMessage[],
  options: CompleteChatOptions = {}
): Promise<CompleteChatResult> {
  const model = options.model ?? DEFAULT_MODEL
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  try {
    const { res, data } = await withExponentialBackoff(
      async () => {
        const res = await fetchWithTimeout(GROQ_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
          }),
          timeoutMs: GROQ_TIMEOUT_MS,
        })
        let data: {
          choices?: Array<{ message?: { content?: string } }>
          error?: { message?: string }
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
        }
        try {
          data = (await res.json()) as typeof data
        } catch {
          throw new Error('Groq 응답 파싱 실패')
        }
        const errMsg = data?.error?.message ?? ''
        if (res.status === 429) {
          console.warn('[Groq] chat/completions rate limited', { model, message: errMsg })
          const err = new Error(`Groq 429: ${errMsg || 'too many requests'}`) as Error & { status?: number }
          err.status = 429
          throw err
        }
        if (res.status === 413) {
          console.warn('[Groq] chat/completions payload too large', { model, message: errMsg })
          const err = new Error(`Groq 413: ${errMsg || 'request entity too large'}`) as Error & { status?: number }
          err.status = 413
          throw err
        }
        if (!res.ok) {
          console.warn('[Groq] chat/completions error', {
            status: res.status,
            model,
            message: errMsg || res.statusText,
          })
          const err = new Error(`Groq ${res.status}: ${errMsg || res.statusText}`) as Error & { status?: number }
          err.status = res.status
          throw err
        }
        return { res, data }
      },
      {
        maxRetries: AI_MAX_RETRIES,
        baseDelayMs: 1000,
        isRetryable: isGroqTransientError,
      }
    )
    const raw = data?.choices?.[0]?.message?.content
    const text = typeof raw === 'string' ? raw.trim() : ''
    if (!text) {
      return { text: null, fallbackMessage: AI_FALLBACK_MESSAGES.GENERIC }
    }
    return {
      text,
      model,
      usage: data?.usage,
    }
  } catch (e) {
    const err = e as { status?: number; message?: string }
    const status = err?.status
    const is413 = status === 413
    const is429 = status === 429
    const isTimeout = /timeout|abort/i.test(String(err?.message ?? e))
    if (is413) {
      console.warn('[Groq] payload too large (413), caller may shrink prompt', {
        model,
        message: err?.message,
      })
      return {
        text: null,
        payloadTooLarge: true,
        httpStatus: 413,
        fallbackMessage: AI_FALLBACK_MESSAGES.GENERIC,
      }
    }
    const fallback = is429
      ? AI_FALLBACK_MESSAGES.QUOTA
      : isTimeout
        ? AI_FALLBACK_MESSAGES.TIMEOUT
        : AI_FALLBACK_MESSAGES.GENERIC
    return {
      text: null,
      ...(is429 ? { quotaError: true, httpStatus: 429 as const } : {}),
      fallbackMessage: fallback,
    }
  }
}
