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

/**
 * Call Groq chat completions with timeout, retry (max 2), and safe parsing.
 * Returns parsed text or quotaError; does not throw for 429.
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
        if (res.status === 429) {
          const err = new Error('Groq 429') as Error & { status?: number }
          err.status = 429
          throw err
        }
        return { res, data }
      },
      { maxRetries: AI_MAX_RETRIES, baseDelayMs: 1000 }
    )
    if (!res.ok) {
      return res.status === 429
        ? { text: null, quotaError: true, fallbackMessage: AI_FALLBACK_MESSAGES.QUOTA }
        : { text: null, fallbackMessage: AI_FALLBACK_MESSAGES.GENERIC }
    }
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
    const is429 = err?.status === 429
    const isTimeout = /timeout|abort/i.test(String(err?.message ?? e))
    const fallback = is429
      ? AI_FALLBACK_MESSAGES.QUOTA
      : isTimeout
        ? AI_FALLBACK_MESSAGES.TIMEOUT
        : AI_FALLBACK_MESSAGES.GENERIC
    return { text: null, ...(is429 ? { quotaError: true } : {}), fallbackMessage: fallback }
  }
}
