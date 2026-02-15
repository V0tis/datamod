/**
 * Groq chat completion for research tab insight (logic/creative/fact).
 * Single responsibility: send messages, return text or quota error.
 */
import { withExponentialBackoff } from '@/lib/gemini-retry'

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = process.env.GROQ_TAB_MODEL ?? 'llama-3.3-70b-versatile'
const DEFAULT_MAX_TOKENS = 2048

export type GroqMessage = { role: 'system' | 'user'; content: string }

export type CompleteChatOptions = {
  model?: string
  maxTokens?: number
}

export type CompleteChatResult = {
  text: string | null
  quotaError?: boolean
}

/**
 * Call Groq chat completions with exponential backoff.
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
        const res = await fetch(GROQ_ENDPOINT, {
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
        })
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>
          error?: { message?: string }
        }
        if (res.status === 429) {
          const err = new Error('Groq 429') as Error & { status?: number }
          err.status = 429
          throw err
        }
        return { res, data }
      },
      { maxRetries: 5, baseDelayMs: 1000 }
    )
    if (!res.ok) {
      return res.status === 429 ? { text: null, quotaError: true } : { text: null }
    }
    const text = data?.choices?.[0]?.message?.content?.trim() ?? ''
    return { text: text || null }
  } catch (e) {
    const is429 = (e as { status?: number })?.status === 429
    return { text: null, ...(is429 ? { quotaError: true } : {}) }
  }
}
